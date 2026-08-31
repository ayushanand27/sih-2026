"""
Graph state for IP-SAKTI.

A single TypedDict threaded through every node. LangGraph merges each node's
returned dict into this state, so a node only needs to return the keys it
actually changes.
"""

from __future__ import annotations

from typing import TypedDict


class GraphState(TypedDict, total=False):
    query: str
    history: list[dict]  # optional prior turns: [{"role": ..., "content": ...}]
    rewritten_query: str
    candidates: list[dict]  # fused top-20, before reranking
    reranked: list[dict]  # reranked top-5
    answer: str
    citations: list[dict]
    flags: dict
