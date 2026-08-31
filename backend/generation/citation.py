"""
Citation attachment for IP-SAKTI.

The LLM never writes citations — this module takes the chunks that were
actually retrieved (not anything the model said) and turns them into the
source list shown to the user. A citation here cannot be hallucinated
because it never passes through the model.
"""

from __future__ import annotations

from generation.prompts import ABSTENTION_MARKER


def is_abstention(answer: str) -> bool:
    """True if the model used the fixed abstention prefix from prompts.py."""
    return answer.strip().startswith(ABSTENTION_MARKER)


def attach_citations(chunks: list[dict]) -> list[dict]:
    """Build the source list from retrieved chunks, deduped by chunk_id.

    Takes only the chunks the retrieval pipeline actually returned — the
    model has no input into which chunks appear here or what their metadata
    says.
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
            }
        )
    return citations
