"""TRAP_01: IP patentability intent must not be answered from D&C-only context."""

from __future__ import annotations

import pytest

from generation.prompts import (
    ABSTENTION_MARKER,
    context_covers_ip_patent,
    is_dc_patent_proprietary_only_framing,
    is_ip_patentability_query,
)
from graph.nodes import generate_answer
from graph.state import DEFAULT_FLAGS

TRAP_01_QUERY = (
    "Can I patent Paracetamol tablet formulations under the classical "
    "Ayurveda drug provisions?"
)

DC_ONLY_CHUNKS = [
    {
        "chunk_id": "Drugs_and_Cosmetics_Act_and_Rules::p13::c7",
        "source_file": "Drugs_and_Cosmetics_Act_and_Rules.pdf",
        "text": (
            'A "patent or proprietary medicine" means a formulation using '
            "ingredients in the First Schedule authoritative books only."
        ),
        "statutory_tags": ["D&C_First_Schedule"],
    },
]

PATENTS_ACT_CHUNK = [
    {
        "chunk_id": "Patents_Act_1970::p10::c1",
        "source_file": "Patents_Act_1970.pdf",
        "text": "Section 3(p) excludes traditional knowledge from patentability.",
        "statutory_tags": ["Patents_Act_Sec3p"],
    },
]


def test_trap01_query_is_ip_patent_intent_not_dc_only():
    assert is_ip_patentability_query(TRAP_01_QUERY)
    assert not is_dc_patent_proprietary_only_framing(TRAP_01_QUERY)


def test_dc_proprietary_definition_query_is_not_ip_patent():
    q = "What is a patent or proprietary medicine under Ayurveda?"
    assert is_dc_patent_proprietary_only_framing(q)
    assert not is_ip_patentability_query(q)


def test_dc_only_chunks_do_not_cover_ip_patent():
    assert not context_covers_ip_patent(DC_ONLY_CHUNKS)


def test_patents_act_chunk_covers_ip_patent():
    assert context_covers_ip_patent(PATENTS_ACT_CHUNK)


@pytest.mark.asyncio
async def test_generate_answer_forces_abstain_on_trap01_dc_context():
    state = {
        "rewritten_query": TRAP_01_QUERY,
        "reranked": DC_ONLY_CHUNKS,
        "formulation_category": "classical",
        "statutory_tags": ["Patents_Act_Sec3p"],
        "formulation_notes": [],
        "flags": dict(DEFAULT_FLAGS),
    }
    result = await generate_answer(state)
    assert result["flags"]["abstained"] is True
    assert result["answer"].startswith(ABSTENTION_MARKER)


@pytest.mark.asyncio
async def test_generate_answer_does_not_abstain_when_patents_act_in_context():
    state = {
        "rewritten_query": "Can I patent a novel synergistic Ayurvedic blend?",
        "reranked": PATENTS_ACT_CHUNK,
        "formulation_category": "classical",
        "statutory_tags": ["Patents_Act_Sec3p"],
        "formulation_notes": [],
        "flags": dict(DEFAULT_FLAGS),
    }
    # Guard should not short-circuit; LLM may still abstain for other reasons.
    from unittest.mock import AsyncMock, patch

    with patch("graph.nodes.agenerate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = "Eligible if inventive step is shown [Patents_Act_1970::p10::c1]."
        result = await generate_answer(state)
    mock_gen.assert_awaited_once()
    assert result["flags"]["abstained"] is False
