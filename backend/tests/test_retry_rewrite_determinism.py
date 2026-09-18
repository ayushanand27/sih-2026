"""
Determinism of graph/nodes.py::retry_rewrite_query's Groq rephrase step.

The bounded retry's *decision* (should_retry) is already proven deterministic
in tests/test_retrieval_determinism.py. This file guards the remaining LLM
step: same input query must yield the same rephrased query across repeated
calls when RETRY_REWRITE_SEED is passed through acomplete().

Requires GROQ_API_KEY (and quota). Skips when unavailable — same pattern as
live integration tests elsewhere in this suite.

Usage:
    python -m pytest tests/test_retry_rewrite_determinism.py -v
"""

from __future__ import annotations

import os

import pytest

from graph.nodes import RETRY_REWRITE_SEED, retry_rewrite_query

# Same query test_retrieval_determinism.py documents as consistently weak on
# first-pass rerank (triggers retry in the full graph).
WEAK_GROUNDING_QUERY = "What is a trademark?"

REPEAT_COUNT = 10


def _groq_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


@pytest.mark.asyncio
async def test_retry_rewrite_seed_constant_is_stable():
    assert RETRY_REWRITE_SEED == 26045


@pytest.mark.asyncio
async def test_retry_rewrite_rephrase_identical_across_ten_runs():
    if not _groq_configured():
        pytest.skip("GROQ_API_KEY not set — cannot run live retry determinism test")

    rephrases: list[str] = []
    for _ in range(REPEAT_COUNT):
        state = {
            "rewritten_query": WEAK_GROUNDING_QUERY,
            "flags": {},
        }
        out = await retry_rewrite_query(state)
        rephrases.append(out["rewritten_query"])

    unique = set(rephrases)
    assert len(unique) == 1, (
        f"retry_rewrite_query produced {len(unique)} distinct rephrases in "
        f"{REPEAT_COUNT} runs (seed={RETRY_REWRITE_SEED}): {unique}"
    )
