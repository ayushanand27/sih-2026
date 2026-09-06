"""
Latency regression test for broad patent-intent queries.

Reproduces the production failure: "I WANT TO PATENT A MEDICINE FORMULA"
used to hang until REQUEST_TIMEOUT (90s). After context truncation and
fast Groq rotation, the full graph should return within 15 seconds.

Usage:
    python -m pytest tests/test_broad_query_latency.py -v
    python scripts/test_broad_query.py
"""

from __future__ import annotations

import asyncio
import time

import pytest

from generation.prompts import is_broad_query, select_chunks_for_generation
from graph.formulation import triage_formulation

BROAD_QUERY = "I WANT TO PATENT A MEDICINE FORMULA"
MAX_LATENCY_SECONDS = 15.0


def test_broad_query_is_classified():
    assert is_broad_query(BROAD_QUERY) is True
    triage = triage_formulation(BROAD_QUERY)
    assert triage["needs_clarification"] is True
    assert triage["clarifying_questions"]


def test_select_chunks_for_generation_caps_context():
    chunks = [
        {"chunk_id": f"c{i}", "text": "x" * 2000, "rerank_score": 1.0 - i * 0.01}
        for i in range(10)
    ]
    selected = select_chunks_for_generation(chunks)
    assert len(selected) <= 4
    total_tokens = sum(len(c["text"]) // 4 for c in selected)
    assert total_tokens <= 1200


@pytest.mark.asyncio
async def test_broad_query_graph_completes_under_15_seconds():
    from retrieval.dense_search import search as dense_search
    from retrieval.reranker import rerank as rerank_sync
    from graph.build_graph import build_graph
    from graph.state import DEFAULT_FLAGS

    await dense_search("warmup", top_k=1, jurisdiction="india")
    await asyncio.to_thread(
        rerank_sync, "warmup", [{"text": "warmup", "chunk_id": "warm"}], top_k=1
    )

    graph = build_graph()
    t0 = time.monotonic()
    result = await asyncio.wait_for(
        graph.ainvoke(
            {
                "query": BROAD_QUERY,
                "history": [],
                "jurisdiction": "india",
                "flags": dict(DEFAULT_FLAGS),
            }
        ),
        timeout=MAX_LATENCY_SECONDS,
    )
    elapsed = time.monotonic() - t0

    assert result.get("answer"), "Expected a non-empty answer"
    assert elapsed < MAX_LATENCY_SECONDS, f"Took {elapsed:.1f}s — exceeds {MAX_LATENCY_SECONDS}s budget"
