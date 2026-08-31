"""
LLM client for IP-SAKTI generation.

Ollama primary (local, works offline — the whole reason it's primary is that
venue WiFi is assumed to fail), Groq as fallback when Ollama is unreachable,
errors, or exceeds OLLAMA_TIMEOUT. The same messages go to both, so falling
back changes speed, not behaviour.

On this dev machine, Ollama's GPU path crashes outright (a CUDA driver /
runtime mismatch — `llama-server process has terminated ... CUDA error:
shared object initialization failed`), so requests are forced to CPU via
`num_gpu: 0`. That crash has nothing to do with this code; it reproduces
with a raw curl call straight to the Ollama HTTP API. Worth re-checking
after an Ollama/driver update, since CPU-only is the slow path: measured
at ~163s for one real grounded-generation call (5 retrieved chunks as
context) on this machine — ~149s of that is prompt processing, ~11s is
token generation. OLLAMA_TIMEOUT is set well under that on purpose, so a
query falls back to Groq rather than making a live demo wait three
minutes.

Usage:
    python -m generation.llm_client "What does Section 3(p) say?"
"""

from __future__ import annotations

import logging
import os
import sys
import time

import ollama
from dotenv import load_dotenv
from groq import Groq

from generation.prompts import SYSTEM_PROMPT, build_user_prompt

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "45"))
# See module docstring: GPU inference crashes the Ollama server on this
# machine. Set OLLAMA_NUM_GPU=-1 in .env to let Ollama pick its own default
# (e.g. once a driver fix is confirmed) instead of forcing CPU.
OLLAMA_NUM_GPU = int(os.getenv("OLLAMA_NUM_GPU", "0"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

_ollama_client: ollama.Client | None = None
_groq_client: Groq | None = None


def _get_ollama_client() -> ollama.Client:
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = ollama.Client(host=OLLAMA_HOST, timeout=OLLAMA_TIMEOUT)
    return _ollama_client


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not set, and Ollama is unreachable — no LLM "
                "backend is available. Copy .env.example to .env and fill it in."
            )
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


def _call_ollama(messages: list[dict]) -> str:
    client = _get_ollama_client()
    options = {"temperature": 0.0}
    if OLLAMA_NUM_GPU >= 0:
        options["num_gpu"] = OLLAMA_NUM_GPU
    response = client.chat(model=OLLAMA_MODEL, messages=messages, options=options)
    return response["message"]["content"].strip()


def _call_groq(messages: list[dict]) -> str:
    client = _get_groq_client()
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.0,
    )
    return response.choices[0].message.content.strip()


def complete(user_prompt: str, system_prompt: str | None = None) -> str:
    """Ollama first, Groq as fallback on timeout, error, or unavailability."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    t0 = time.monotonic()
    try:
        answer = _call_ollama(messages)
        log.info("Ollama answered in %.1fs", time.monotonic() - t0)
        return answer
    except Exception as exc:
        log.warning(
            "Ollama unavailable after %.1fs (%s) — falling back to Groq",
            time.monotonic() - t0,
            exc,
        )

    try:
        return _call_groq(messages)
    except Exception as exc:
        raise RuntimeError(
            f"No LLM backend reachable: Ollama failed and Groq failed ({exc}). "
            "Check that Ollama is running (OLLAMA_HOST) or GROQ_API_KEY / "
            "network connectivity."
        ) from exc


def generate(query: str, chunks: list[dict]) -> str:
    return complete(build_user_prompt(query, chunks), system_prompt=SYSTEM_PROMPT)


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "What does Section 3(p) say about traditional knowledge?"
    answer = generate(query, chunks=[])
    print(f"\nQuery: {query!r}\n")
    print(answer)
