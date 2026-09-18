"""Conservative statutory citation matching for the eval harness only."""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List

_STOPWORDS = frozenset({"and", "the", "of", "a", "an", "for", "to", "under", "on"})

_SECTION_HEAD_RE = re.compile(
    r"^(?:section|sec\.?|s\.?|art(?:icle)?\.?)\s*(\d+)\s*(?:\(([^)]+)\))?\s*$",
    re.IGNORECASE,
)
_FORM_RE = re.compile(r"^form\s+(\d+)\s*$", re.IGNORECASE)
_ACRONYM_RE = re.compile(r"^[A-Z0-9]{2,10}$")


def normalize_statutory_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.lower().replace("_", " ")
    text = re.sub(r"[\u00a0\u202f\u2009]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_citation_corpus(
    response_citations: List[Dict[str, Any]], answer_text: str
) -> str:
    """Union of citation metadata, verbatim snippets, and answer prose."""
    fields: List[str] = []
    for citation in response_citations:
        for key in (
            "source_file",
            "section_heading",
            "chunk_id",
            "exact_snippet",
            "text",
        ):
            value = citation.get(key)
            if value:
                fields.append(str(value))
    if answer_text:
        fields.append(answer_text)
    return normalize_statutory_text(" ".join(fields))


def _corpus_has_section(corpus: str, number: str, subclause: str | None) -> bool:
    if subclause:
        sub = re.escape(subclause.strip().lower())
        patterns = [
            rf"\b(?:section|sec\.?|s\.?|art(?:icle)?\.?)\s*{number}\s*\(\s*{sub}\s*\)",
            rf"\b{number}\s*\(\s*{sub}\s*\)",
        ]
    else:
        patterns = [
            rf"\b(?:section|sec\.?|s\.?|art(?:icle)?\.?)\s*{number}\b",
            rf"\b{number}\s*\([a-z0-9]+\)",
        ]
    return any(re.search(pat, corpus) for pat in patterns)


def _corpus_has_form(corpus: str, number: str) -> bool:
    return bool(re.search(rf"\bform\s*{number}\b", corpus))


def _corpus_has_acronym(corpus: str, acronym: str) -> bool:
    return bool(re.search(rf"\b{re.escape(acronym.lower())}\b", corpus))


def _corpus_has_phrase_tokens(corpus: str, phrase: str) -> bool:
    tokens = [
        token
        for token in re.findall(r"[a-z0-9]+", normalize_statutory_text(phrase))
        if token not in _STOPWORDS and len(token) >= 2
    ]
    if not tokens:
        return False
    return all(re.search(rf"\b{re.escape(token)}\b", corpus) for token in tokens)


def expected_statute_matches(expected: str, corpus: str) -> bool:
    """True when a single benchmark expected_statutes entry is reflected in corpus."""
    if not expected:
        return False

    norm_expected = normalize_statutory_text(expected)
    if norm_expected and norm_expected in corpus:
        return True

    stripped = expected.strip()

    form_match = _FORM_RE.match(stripped)
    if form_match:
        return _corpus_has_form(corpus, form_match.group(1))

    section_match = _SECTION_HEAD_RE.match(stripped)
    if section_match:
        return _corpus_has_section(
            corpus, section_match.group(1), section_match.group(2)
        )

    if _ACRONYM_RE.match(stripped):
        return _corpus_has_acronym(corpus, stripped)

    if norm_expected == "first schedule":
        return "first schedule" in corpus or (
            "first" in corpus and "schedule" in corpus
        )

    return _corpus_has_phrase_tokens(corpus, expected)


def check_citations_matched(
    response_citations: List[Dict[str, Any]],
    answer_text: str,
    expected_statutes: List[str],
) -> bool:
    """True if ANY expected statutory marker appears in citations or answer."""
    if not expected_statutes:
        return True

    corpus = build_citation_corpus(response_citations, answer_text)
    return any(
        expected_statute_matches(statute, corpus) for statute in expected_statutes
    )
