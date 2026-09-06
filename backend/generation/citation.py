"""
Citation attachment for IP-SAKTI.

The LLM never writes citations — this module takes the chunks that were
actually retrieved (not anything the model said) and turns them into the
source list shown to the user. A citation here cannot be hallucinated
because it never passes through the model.
"""

from __future__ import annotations

import re

from generation.prompts import ABSTENTION_MARKER


def is_abstention(answer: str) -> bool:
    """True if the model used the fixed abstention prefix from prompts.py."""
    return answer.strip().startswith(ABSTENTION_MARKER)


# "Section 3(p)", "Article 3", "Rule 158B" — a statutory locator shaped
# reference. Deliberately not "Chapter"/"Schedule"/"Part": those are broader
# groupings a model could legitimately paraphrase ("the definitions
# chapter") without quoting a locator, so checking them would just produce
# false positives rather than a real signal.
_STATUTORY_REFERENCE_PATTERN = re.compile(
    r"\b(?:Section|Article|Rule)\s+\d+[A-Za-z]?(?:\(\w+\))*", re.I
)


def find_ungrounded_references(answer: str, chunks: list[dict]) -> list[str]:
    """
    Best-effort post-generation grounding check: every "Section N" / "Article
    N" / "Rule N"-shaped locator the model's answer names should appear
    somewhere in the actual retrieved text it was given (rule 1 in
    prompts.py: answer ONLY from the Context). If a locator the model named
    appears nowhere in the retrieved chunks' own text, that's a concrete,
    checkable sign the number may have come from pretraining rather than
    the Context, despite the prompt telling it not to.

    Deliberately NOT used to strip or rewrite the answer text: surgically
    removing "Section 15" from "...as described in Section 15 of the
    Act..." leaves an ungrammatical fragment, and there's no reliable way
    to tell whether the surrounding sentence still makes sense without it.
    Citations in this project are only ever attached from real retrieved
    chunks (see attach_citations above), never extracted from or edited
    into the model's own text — this check follows the same rule: it's a
    diagnostic for the caller to log or act on, not a text editor.

    Not exhaustive in the other direction either: correct prose can
    reference a section without ever repeating its exact "Section N"
    spelling (e.g. "the definition clause" instead of "Section 2(1)(zb)"),
    so an empty result here is not proof the whole answer is grounded —
    only that no locator-shaped claim it DID make is unverifiable this way.
    """
    if not answer or not chunks:
        return []

    context_text = " ".join(chunk.get("text", "") for chunk in chunks).lower()
    referenced = {
        " ".join(match.group(0).split())
        for match in _STATUTORY_REFERENCE_PATTERN.finditer(answer)
    }
    return sorted(ref for ref in referenced if ref.lower() not in context_text)


_SNIPPET_MIN_CHARS = 100
_SNIPPET_MAX_CHARS = 250

# Ingestion prepends context headers ("[Statute: ...]", "[Chapter: ...]",
# "[Section: ...]", "[Classification: ...]" — see ingestion/chunker.py) to
# every chunk's stored text. Strip those before snippeting so the quoted
# "exact statutory text" a user sees is the actual clause, not our own
# bracketed metadata about it.
_HEADER_LINE_PATTERN = re.compile(r"^\[(?:Statute|Chapter|Section|Classification):.*\]\s*$")


def _extract_exact_snippet(chunk_text: str) -> str:
    """
    Deterministic, verbatim substring of the real indexed chunk text — never
    LLM-generated, same "can't be hallucinated because it never passes
    through the model" guarantee as the rest of this module. Truncates to
    roughly _SNIPPET_MIN_CHARS.._SNIPPET_MAX_CHARS chars, preferring a
    sentence boundary so the quote reads as a complete clause rather than a
    mid-word cut, but falls back to a hard cut at _SNIPPET_MAX_CHARS if no
    such boundary exists in range (short chunks just return their full text).
    """
    lines = [
        line for line in chunk_text.splitlines() if not _HEADER_LINE_PATTERN.match(line.strip())
    ]
    body = " ".join(line.strip() for line in lines if line.strip())

    if len(body) <= _SNIPPET_MAX_CHARS:
        return body

    window = body[:_SNIPPET_MAX_CHARS]
    boundary = max(window.rfind(". "), window.rfind("; "))
    if boundary >= _SNIPPET_MIN_CHARS:
        return window[: boundary + 1]
    return window.rstrip() + "…"


# A tag the model was instructed to copy verbatim from a "[Chunk_ID: ...]"
# marker (see prompts.py rule 3 / build_user_prompt) — chunk ids in this
# project are hex sha256-style digests (see ingestion/chunker.py), but the
# pattern is deliberately loose (any bracketed token with no whitespace) so
# it still catches a malformed or truncated id instead of silently ignoring it.
_INLINE_CITATION_TAG_PATTERN = re.compile(r"\[([^\[\]\s]+)\]")


def find_invalid_inline_citation_tags(answer: str, chunks: list[dict]) -> list[str]:
    """
    Same philosophy as find_ungrounded_references above, applied to the
    inline "[chunk_id]" tags rule 3 in prompts.py now asks the model to
    write: a tag is only trustworthy if it names a chunk_id that was
    actually retrieved for this query. This function never edits or strips
    the answer text — inline tags are a best-effort reader aid, not the
    authoritative citation record (attach_citations() above is, and it never
    reads the model's output at all) — it only reports which emitted tags,
    if any, don't correspond to a real retrieved chunk, so the caller can log
    it as a signal the model didn't follow rule 3 correctly.
    """
    if not answer or not chunks:
        return []

    real_ids = {chunk["chunk_id"] for chunk in chunks}
    tagged = {match.group(1) for match in _INLINE_CITATION_TAG_PATTERN.finditer(answer)}
    return sorted(tagged - real_ids)


def attach_citations(chunks: list[dict]) -> list[dict]:
    """Build the source list from retrieved chunks, deduped by chunk_id.

    Takes only the chunks the retrieval pipeline actually returned — the
    model has no input into which chunks appear here or what their metadata
    says. `exact_snippet` is likewise sliced directly from the retrieved
    chunk's own `text` field in code (_extract_exact_snippet above) — it is
    not something the LLM writes or paraphrases.
    """
    seen: set[str] = set()
    citations = []
    for chunk in chunks:
        chunk_id = chunk["chunk_id"]
        if chunk_id in seen:
            continue
        seen.add(chunk_id)
        citations.append(
            {
                "chunk_id": chunk_id,
                "source_file": chunk["source_file"],
                "page_number": chunk["page_number"],
                "section_heading": chunk["section_heading"],
                "exact_snippet": _extract_exact_snippet(chunk.get("text", "")),
            }
        )
    return citations
