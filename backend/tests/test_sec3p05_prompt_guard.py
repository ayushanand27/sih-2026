"""SEC3P_05: classical Bhasma + patent protection must not hit TRAP_01 guard."""

from __future__ import annotations

from generation.prompts import (
    SYSTEM_PROMPT,
    should_force_ip_patent_context_abstention,
)

SEC3P_05_QUERY = (
    "Are classical Bhasma preparations like Swarna Bhasma eligible for "
    "patent protection in India?"
)


def test_sec3p05_query_does_not_force_ip_patent_trap_abstention():
    assert not should_force_ip_patent_context_abstention(SEC3P_05_QUERY, [])


def test_system_prompt_includes_classical_bhasma_patent_rule():
    assert "Bhasma" in SYSTEM_PROMPT
    assert "patent protection" in SYSTEM_PROMPT
