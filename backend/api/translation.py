"""
Translation bridge for IP-SAKTI (Bhashini primary, Sarvam fallback).

Retrieval and generation only ever operate on English (dense/sparse
retrieval and the grounded-generation prompt are tuned against English
statutory text — see generation/prompts.py). This module is what lets a
non-English question in and a non-English answer back out around that:
translate the incoming question to English before it reaches the graph,
translate the graph's English answer back to the user's language before it
leaves the process.

Primary: MeitY Bhashini / ULCA two-step pipeline (config → inference).
Fallback: Sarvam AI if Bhashini fails, times out, or credentials are
missing — same philosophy as generation/llm_client.py (try primary, log,
fall back).

The public entry point `translate_text` fails open for callers: Bhashini
raises internally; Sarvam path logs and returns original text on failure.

Chunks past SARVAM_MAX_CHARS: Sarvam's `mayura:v1` model hard-rejects input
over exactly 1000 characters — see module history in git. Bhashini sends
one request per call (long answers fall back to chunked Sarvam if needed).

Usage:
    python -m api.translation "traditional knowledge patent exclusion" hi-IN en-IN
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
from typing import NamedTuple

import httpx
from dotenv import load_dotenv

from api.text_chunking import split_text

load_dotenv(override=True)

log = logging.getLogger(__name__)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
SARVAM_BASE_URL = "https://api.sarvam.ai"
TRANSLATE_TIMEOUT = 10.0
SARVAM_MAX_CHARS = int(os.getenv("SARVAM_MAX_CHARS", "950"))

BHASHINI_UDYAT_KEY = os.getenv("BHASHINI_UDYAT_KEY")
BHASHINI_INFERENCE_KEY = os.getenv("BHASHINI_INFERENCE_KEY")
BHASHINI_PIPELINE_CONFIG_URL = (
    "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
)
# Public Bhashini translation pipeline id (not a secret); override if MeitY
# assigns a dedicated pipeline to your project.
BHASHINI_PIPELINE_ID = os.getenv(
    "BHASHINI_PIPELINE_ID", "64392f96daac500b55c543cd"
)
BHASHINI_CONFIG_TIMEOUT = 10.0
BHASHINI_INFERENCE_TIMEOUT = 15.0
# Used when pipeline config omits pipelineInferenceAPIEndPoint (some Udyat
# accounts return serviceId only); matches Bhashini's documented default.
BHASHINI_DEFAULT_INFERENCE_URL = (
    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
)

TARGET_LANGUAGE_CODES: tuple[str, ...] = (
    "en-IN",
    "hi-IN",
    "bn-IN",
    "gu-IN",
    "kn-IN",
    "ml-IN",
    "mr-IN",
    "od-IN",
    "pa-IN",
    "ta-IN",
    "te-IN",
    "as-IN",
    "brx-IN",
    "doi-IN",
    "kok-IN",
    "ks-IN",
    "mai-IN",
    "mni-IN",
    "ne-IN",
    "sa-IN",
    "sat-IN",
    "sd-IN",
    "ur-IN",
)
SOURCE_LANGUAGE_CODES: tuple[str, ...] = ("auto", *TARGET_LANGUAGE_CODES)

_RASA_SHASTRA = "Rasa Shastra"

PROTECTED_AYURVEDIC_TERMS: dict[str, str] = {
    "churna": "Churna",
    "churn": "Churna",
    "chura": "Churna",
    "चूर्ण": "Churna",
    "bhasma": "Bhasma",
    "bhasm": "Bhasma",
    "भस्म": "Bhasma",
    "taila": "Taila",
    "tail": "Taila",
    "तैल": "Taila",
    "तेल": "Taila",
    "kwath": "Kwatha",
    "kwatha": "Kwatha",
    "kashaya": "Kwatha",
    "काढा": "Kwatha",
    "क्वाथ": "Kwatha",
    "rasa shastra": _RASA_SHASTRA,
    "rasashastra": _RASA_SHASTRA,
    "रस शास्त्र": _RASA_SHASTRA,
    "रसशास्त्र": _RASA_SHASTRA,
    "asava": "Asava",
    "आसव": "Asava",
    "arishta": "Arishta",
    "अरिष्ट": "Arishta",
}

_PROTECT_PLACEHOLDER = "9911{index:04d}1199"

# Repo uses BCP-47 (hi-IN); Bhashini ULCA expects ISO 639-1 base codes.
_BHASHINI_LANG_OVERRIDES: dict[str, str] = {
    "od": "or",
}


class _BhashiniPipeline(NamedTuple):
    callback_url: str
    service_id: str


_pipeline_cache: dict[tuple[str, str], _BhashiniPipeline] = {}
_bhashini_step1_auth_approach: str | None = None


def _protect_terms(text: str) -> tuple[str, dict[str, str]]:
    """Swap every recognized Ayurvedic term for an opaque, translation-model-
    safe placeholder token, so Sarvam never actually sees the term and can't
    mistranslate or transliterate it. Longest terms first, so a multi-word
    entry (e.g. "rasa shastra") matches before its component single words
    could claim part of it. Returns the modified text and a placeholder ->
    canonical-term mapping for _restore_terms() to reverse afterward.
    """
    terms_longest_first = sorted(PROTECTED_AYURVEDIC_TERMS, key=len, reverse=True)
    mapping: dict[str, str] = {}
    counter = [0]

    for term in terms_longest_first:
        canonical = PROTECTED_AYURVEDIC_TERMS[term]
        pattern = re.compile(re.escape(term), re.IGNORECASE)

        def _replace(match: re.Match, canonical: str = canonical) -> str:
            placeholder = _PROTECT_PLACEHOLDER.format(index=counter[0])
            counter[0] += 1
            mapping[placeholder] = canonical
            return placeholder

        text = pattern.sub(_replace, text)

    return text, mapping


def _restore_terms(text: str, mapping: dict[str, str]) -> str:
    for placeholder, canonical in mapping.items():
        text = text.replace(placeholder, canonical)
    return text


def _bhashini_iso_lang(code: str) -> str:
    base = code.split("-", 1)[0].lower()
    return _BHASHINI_LANG_OVERRIDES.get(base, base)


def _build_bhashini_step1_headers(approach: str = "B") -> dict[str, str]:
    """ULCA pipeline-config auth. Approach A: udyat key as userID + ulcaApiKey.
    Approach B: ulcaApiKey only (no userID header). Switch approaches here."""
    udyat = BHASHINI_UDYAT_KEY or ""
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "ulcaApiKey": udyat,
    }
    if approach == "A":
        headers["userID"] = udyat
    return headers


def _bhashini_pipeline_config_body(source_iso: str, target_iso: str) -> dict:
    return {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_iso,
                        "targetLanguage": target_iso,
                    }
                },
            }
        ],
        "pipelineRequestConfig": {"pipelineId": BHASHINI_PIPELINE_ID},
    }


def _bhashini_inference_body(
    text: str, source_iso: str, target_iso: str, service_id: str
) -> dict:
    return {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_iso,
                        "targetLanguage": target_iso,
                    },
                    "serviceId": service_id,
                },
            }
        ],
        "inputData": {
            "input": [{"source": text}],
            "audio": [{"audioContent": None}],
        },
    }


def _is_bhashini_auth_failure(response: httpx.Response) -> bool:
    if response.status_code in (401, 403):
        return True
    body = response.text.lower()
    return any(
        token in body
        for token in (
            "unauthorized",
            "invalid api key",
            "invalid key",
            "ulcaapikey",
            "userid",
            "authentication",
        )
    )


def _should_retry_bhashini_step1(
    response: httpx.Response, has_more_approaches: bool
) -> bool:
    if not has_more_approaches:
        return False
    if _is_bhashini_auth_failure(response):
        return True
    return response.status_code == 400 and "ulcaapikey" in response.text.lower()


def _parse_bhashini_pipeline_config(data: dict) -> _BhashiniPipeline:
    try:
        config_block = data["pipelineResponseConfig"][0]["config"][0]
        service_id = config_block["serviceId"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError(
            f"Bhashini pipeline config missing expected fields: {data!r}"
        ) from exc
    endpoint = data.get("pipelineInferenceAPIEndPoint") or {}
    callback_url = endpoint.get("callbackUrl")
    if not callback_url:
        log.warning(
            "Bhashini pipeline config omitted pipelineInferenceAPIEndPoint; "
            "using default inference URL %s",
            BHASHINI_DEFAULT_INFERENCE_URL,
        )
        callback_url = BHASHINI_DEFAULT_INFERENCE_URL
    if not service_id:
        raise ValueError(f"Bhashini pipeline config incomplete: {data!r}")
    return _BhashiniPipeline(callback_url=callback_url, service_id=service_id)


def _parse_bhashini_translation(data: dict) -> str:
    pipeline_response = data.get("pipelineResponse")
    if pipeline_response is None and data.get("taskType") == "translation":
        pipeline_response = [data]
    if not isinstance(pipeline_response, list):
        raise ValueError(f"Bhashini inference had no pipelineResponse: {data!r}")
    for task in pipeline_response:
        if task.get("taskType") != "translation":
            continue
        outputs = task.get("output") or []
        if outputs and outputs[0].get("target"):
            return str(outputs[0]["target"]).strip()
    raise ValueError(f"Bhashini inference had no translation target: {data!r}")


async def _fetch_bhashini_pipeline_config(
    client: httpx.AsyncClient, source_iso: str, target_iso: str
) -> _BhashiniPipeline:
    global _bhashini_step1_auth_approach

    if not BHASHINI_UDYAT_KEY:
        raise RuntimeError("BHASHINI_UDYAT_KEY is not set")

    cache_key = (source_iso, target_iso)
    if cache_key in _pipeline_cache:
        return _pipeline_cache[cache_key]

    body = _bhashini_pipeline_config_body(source_iso, target_iso)
    approaches: list[str]
    if _bhashini_step1_auth_approach:
        approaches = [_bhashini_step1_auth_approach]
    else:
        approaches = ["B", "A"]

    last_exc: Exception | None = None
    for index, approach in enumerate(approaches):
        response = await client.post(
            BHASHINI_PIPELINE_CONFIG_URL,
            headers=_build_bhashini_step1_headers(approach),
            json=body,
            timeout=BHASHINI_CONFIG_TIMEOUT,
        )
        if response.is_success:
            parsed = _parse_bhashini_pipeline_config(response.json())
            if _bhashini_step1_auth_approach is None:
                _bhashini_step1_auth_approach = approach
                log.info(
                    "Bhashini pipeline config succeeded with auth approach %s",
                    approach,
                )
            return parsed

        has_more = index < len(approaches) - 1
        if _should_retry_bhashini_step1(response, has_more):
            last_exc = httpx.HTTPStatusError(
                f"Bhashini step-1 failed (approach {approach}, "
                f"{response.status_code})",
                request=response.request,
                response=response,
            )
            log.debug(
                "Bhashini pipeline config approach %s rejected (%s), trying next",
                approach,
                response.status_code,
            )
            continue

        response.raise_for_status()
        raise ValueError(
            f"Bhashini pipeline config failed ({response.status_code}): "
            f"{response.text[:500]}"
        )

    raise RuntimeError(
        "Bhashini pipeline config auth failed for all approaches"
    ) from last_exc


async def bhashini_translate(text: str, source_lang: str, target_lang: str) -> str:
    """Translate via Bhashini ULCA pipeline. Raises on any failure."""
    if not text.strip():
        return text
    if source_lang == target_lang:
        return text
    if not BHASHINI_UDYAT_KEY or not BHASHINI_INFERENCE_KEY:
        raise RuntimeError("Bhashini credentials are not configured")

    source_iso = _bhashini_iso_lang(source_lang)
    target_iso = _bhashini_iso_lang(target_lang)
    if source_iso == target_iso:
        return text

    async with httpx.AsyncClient() as client:
        cache_key = (source_iso, target_iso)
        if cache_key in _pipeline_cache:
            pipeline = _pipeline_cache[cache_key]
        else:
            pipeline = await _fetch_bhashini_pipeline_config(
                client, source_iso, target_iso
            )
        inference_response = await client.post(
            pipeline.callback_url,
            headers={
                "Content-Type": "application/json",
                "Authorization": BHASHINI_INFERENCE_KEY,
            },
            json=_bhashini_inference_body(
                text, source_iso, target_iso, pipeline.service_id
            ),
            timeout=BHASHINI_INFERENCE_TIMEOUT,
        )
        inference_response.raise_for_status()
        translated = _parse_bhashini_translation(inference_response.json())
        if cache_key not in _pipeline_cache:
            _pipeline_cache[cache_key] = pipeline
        return translated


_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=SARVAM_BASE_URL, timeout=TRANSLATE_TIMEOUT)
    return _client


async def _translate_chunk(
    client: httpx.AsyncClient, text: str, source_lang: str, target_lang: str
) -> str:
    """One Sarvam call, <= SARVAM_MAX_CHARS input. Raises on any failure."""
    response = await client.post(
        "/translate",
        headers={"api-subscription-key": SARVAM_API_KEY},
        json={
            "input": text,
            "source_language_code": source_lang,
            "target_language_code": target_lang,
        },
    )
    response.raise_for_status()
    translated = response.json().get("translated_text")
    if not translated:
        raise ValueError(f"Sarvam response had no translated_text: {response.json()!r}")
    return translated


async def sarvam_translate(
    text: str, source_lang: str, target_lang: str
) -> tuple[str, bool]:
    """
    Sarvam-only translation with Ayurvedic term protection and chunking.
    Fail-open: logs and returns original text on failure (does not raise).
    Second value is True when translation succeeded (or was skipped as a
    no-op), False when the original text is returned due to failure.
    """
    if not text.strip():
        return text, True
    if source_lang == target_lang:
        return text, True

    if not SARVAM_API_KEY:
        log.warning("SARVAM_API_KEY is not set — returning text untranslated")
        return text, False

    protected_text, term_mapping = _protect_terms(text)
    chunks = split_text(protected_text, SARVAM_MAX_CHARS)
    try:
        client = _get_client()
        translated_chunks = await asyncio.gather(
            *(
                _translate_chunk(client, chunk, source_lang, target_lang)
                for chunk in chunks
            )
        )
        return _restore_terms(" ".join(translated_chunks), term_mapping), True
    except Exception as exc:
        log.warning(
            "Translation failed (%s -> %s, %d chunk(s)): %s — returning original text",
            source_lang,
            target_lang,
            len(chunks),
            exc,
        )
        return text, False


async def translate_text(
    text: str, source_lang: str, target_lang: str
) -> tuple[str, bool]:
    """
    Primary Bhashini translation with Sarvam fallback. Public API for /query
    and tests — does not raise; worst case returns original text via Sarvam
    fail-open. Second value is `translation_degraded`: True only when
    Bhashini was attempted, failed, and Sarvam fail-open also returned the
    original text unchanged.
    """
    if not text.strip():
        return text, False
    if source_lang == target_lang:
        return text, False

    bhashini_attempted = bool(BHASHINI_UDYAT_KEY and BHASHINI_INFERENCE_KEY)
    if bhashini_attempted:
        try:
            protected_text, term_mapping = _protect_terms(text)
            translated = await bhashini_translate(
                protected_text, source_lang, target_lang
            )
            return _restore_terms(translated, term_mapping), False
        except Exception as exc:
            log.warning(
                "Bhashini translation failed (%s -> %s): %s — falling back to Sarvam",
                source_lang,
                target_lang,
                exc,
            )

    translated, sarvam_ok = await sarvam_translate(text, source_lang, target_lang)
    degraded = bhashini_attempted and not sarvam_ok
    return translated, degraded


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    args = sys.argv[1:]
    if len(args) < 3:
        print('Usage: python -m api.translation "<text>" <source_lang> <target_lang>')
        print('e.g.:  python -m api.translation "traditional knowledge" en-IN hi-IN')
        sys.exit(1)

    text, source_lang, target_lang = args[0], args[1], args[2]
    result, _degraded = asyncio.run(translate_text(text, source_lang, target_lang))
    print(f"\n{source_lang} -> {target_lang}")
    print(f"in:  {text}")
    print(f"out: {result}")
