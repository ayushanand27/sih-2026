"""
Graph nodes for IP-SAKTI.

Each node takes the running GraphState and returns a dict of only the keys
it changes — LangGraph merges that into the state. The real logic already
lives in retrieval/ and generation/; nodes just call into it, they don't
reimplement it.

Nodes that do I/O (LLM calls, pgvector queries) are async, awaited via
compiled_graph.ainvoke() in api/main.py — not run_in_threadpool. Nodes that
are pure CPU-bound logic with no I/O (should_retry, attach_citations_node)
stay sync; LangGraph runs sync and async nodes side by side in the same
graph without issue.
"""

from __future__ import annotations

import asyncio
import logging

from generation.citation import (
    attach_citations,
    find_invalid_inline_citation_tags,
    find_ungrounded_references,
    is_abstention,
)
from generation.llm_client import acomplete, agenerate
from generation.prompts import append_disclaimer, append_formulation_notes, is_broad_query, select_chunks_for_generation
from graph.formulation import CATEGORY_STATUTORY_TAGS, triage_formulation
from graph.state import DEFAULT_FLAGS, DEFAULT_JURISDICTION, GraphState
from graph_kg.kg import related_provisions_for
from retrieval.bm25_search import search as bm25_search_sync
from retrieval.dense_search import search as dense_search
from retrieval.fusion import fuse
from retrieval.reranker import rerank as rerank_sync

log = logging.getLogger(__name__)

# 40, not 20: raised after finding a real regression from
# HierarchicalStatutoryChunker, not a hypothetical one. Clause-level chunks
# are shorter and lexically sparser than the old ~2000-char sliding-window
# chunks, so a single relevant clause can rank well individually on BM25 or
# dense (e.g. Patents_Act_1970's Section 3(p) clause: BM25 rank 59, dense
# rank 12, both for the literal query "What does Section 3(p) say about
# traditional knowledge?" — a query that worked reliably all session before
# this chunker existed) but still miss RRF's combined top-20 cutoff, since
# RRF rewards a chunk that scores decently on *both* signals over one that
# scores well on only one. Confirmed empirically: at 20, the model saw only
# generic background chunks and correctly-per-its-context abstained
# ("which act's Section 3(p)?"); at 40, the actual Section 3(p) passage
# (Patent_Office_Manual_Practice_Procedure_2011) becomes the top candidate
# at 0.997 confidence. 40 was chosen as the smallest tested value that
# fixed this specific regression — not pushed further, since a similar
# investigation for "What is a trademark?" (a query that was already
# unreliable before this chunker, not something this chunker broke) showed
# that query's actual definitional clause needs top-~500 pooling to
# reach, and doubling every query's reranking cost to chase one already-
# marginal query isn't a trade worth making — see
# tests/test_retrieval_determinism.py's module docstring.
FUSED_TOP_K = 40
RERANK_TOP_K = 5
# Broad patent-intent queries don't need a deep pool — smaller retrieval +
# rerank cuts CPU cross-encoder time so the pipeline stays under ~15s.
BROAD_FUSED_TOP_K = 15
BROAD_RERANK_TOP_K = 4


def _fused_top_k(query: str) -> int:
    return BROAD_FUSED_TOP_K if is_broad_query(query) else FUSED_TOP_K


def _rerank_top_k(query: str) -> int:
    return BROAD_RERANK_TOP_K if is_broad_query(query) else RERANK_TOP_K

# rerank_score is now a calibrated sigmoid(raw_logit) in [0, 1] — see
# retrieval/reranker.py's module docstring for the empirical spread this was
# set against (on-topic queries: 0.92-0.999; queries with no real answer in
# this corpus: ~0.000). 0.15 sits well above the "nothing here" cluster.
RERANK_SCORE_THRESHOLD = 0.15

# A separate, lower bar for the weak-grounding diagnostic below — distinct
# from RERANK_SCORE_THRESHOLD (which decides whether to retry), this one
# flags a specific, more informative situation: BM25 found what looks like
# a real lexical hit (raw score above BM25_STRONG_MATCH), but the
# cross-encoder still isn't confident. That combination means "probably
# retrieval's fault, not the corpus's" — worth surfacing to a caller
# distinctly from a generic abstention, per the fallback-diagnostic ask.
BM25_STRONG_MATCH = 8.0
WEAK_GROUNDING_CONFIDENCE = 0.10


async def rewrite_query(state: GraphState) -> dict:
    """Standalone-question rewrite from chat history.

    A no-op without history, so a single-turn query passes through
    unchanged end to end — this keeps single-turn graph output identical
    to calling retrieval/generation directly.
    """
    history = state.get("history") or []
    query = state["query"]

    if not history:
        return {"rewritten_query": query}

    transcript = "\n".join(f"{turn['role']}: {turn['content']}" for turn in history)
    prompt = (
        "Rewrite the latest user question as a standalone question that "
        "makes sense without the prior conversation below. Keep it short. "
        "Output only the rewritten question, nothing else.\n\n"
        f"{transcript}\nuser: {query}"
    )
    rewritten = await acomplete(prompt)
    return {"rewritten_query": rewritten or query}


def triage_formulation_node(state: GraphState) -> dict:
    """Deterministic keyword classification — no I/O, no LLM call. Runs
    after rewrite_query (so it sees the standalone-question form) and
    before retrieve. See graph/formulation.py for why this is intentionally
    not LLM-based, and for needs_clarification/clarifying_questions: set
    when the question's keywords span 2+ formulation categories, surfaced
    to the caller but not blocking — generation proceeds using the
    first-matched category regardless."""
    query = state.get("rewritten_query") or state["query"]
    triage = triage_formulation(query)
    return {
        "formulation_category": triage["formulation_category"],
        "formulation_notes": triage["formulation_notes"],
        "statutory_tags": CATEGORY_STATUTORY_TAGS[triage["formulation_category"]],
        "needs_clarification": triage["needs_clarification"],
        "clarifying_questions": triage["clarifying_questions"],
    }


async def retrieve(state: GraphState) -> dict:
    """Hybrid retrieval (BM25 + dense, fused by RRF) on the current query,
    scoped to state["jurisdiction"]. BM25 has no I/O (in-memory index), so
    it's only offloaded to a thread to avoid blocking the event loop; dense
    search and the fusion metadata backfill hit pgvector and are natively
    async all the way down.
    """
    query = state["rewritten_query"]
    jurisdiction = state.get("jurisdiction") or DEFAULT_JURISDICTION
    fused_k = _fused_top_k(query)

    bm25_results = await asyncio.to_thread(bm25_search_sync, query, top_k=fused_k, jurisdiction=jurisdiction)
    dense_results = await dense_search(query, top_k=fused_k, jurisdiction=jurisdiction)
    candidates = await fuse(
        bm25_results, dense_results, top_k=fused_k, jurisdiction=jurisdiction
    )
    # Carried into rerank_node purely for the weak-grounding diagnostic
    # below — not used for ranking or filtering.
    bm25_top_score = max((r["score"] for r in bm25_results), default=0.0)
    return {"candidates": candidates, "bm25_top_score": bm25_top_score}


async def rerank_node(state: GraphState) -> dict:
    query = state["rewritten_query"]
    reranked = await asyncio.to_thread(
        rerank_sync, query, state["candidates"], top_k=_rerank_top_k(query)
    )

    flags = dict(state.get("flags") or {})
    bm25_top_score = state.get("bm25_top_score", 0.0)
    top_confidence = reranked[0]["rerank_score"] if reranked else 0.0
    flags["weak_grounding"] = bm25_top_score >= BM25_STRONG_MATCH and top_confidence < WEAK_GROUNDING_CONFIDENCE
    if flags["weak_grounding"]:
        log.warning(
            "Weak grounding: BM25 found a strong lexical match (score %.1f) but the "
            "cross-encoder's top confidence is only %.3f — likely a retrieval/reranking "
            "gap rather than the corpus genuinely lacking an answer.",
            bm25_top_score, top_confidence,
        )

    # Exposed to the API response as QueryResponse.confidence_score — the
    # same calibrated sigmoid(raw_logit) that decides should_retry, not a
    # separately-invented number. 0.0 (not missing) when reranked is empty,
    # so callers never need a None check.
    return {"reranked": reranked, "flags": flags, "confidence_score": top_confidence}


def should_retry(state: GraphState) -> str:
    """Conditional edge after reranking.

    Retries retrieval once, and only once, if the top rerank score looks
    weak. flags["retried"] guards against a second retry — once set, this
    always routes to "generate" regardless of score, so the branch is
    bounded, never a loop.
    """
    flags = state.get("flags") or {}
    if flags.get("retried"):
        return "generate"

    query = state.get("rewritten_query") or state.get("query") or ""
    if is_broad_query(query):
        return "generate"

    reranked = state.get("reranked") or []
    if not reranked or reranked[0]["rerank_score"] < RERANK_SCORE_THRESHOLD:
        log.info(
            "Top rerank score %.3f below threshold %.1f — retrying retrieval once",
            reranked[0]["rerank_score"] if reranked else float("-inf"),
            RERANK_SCORE_THRESHOLD,
        )
        return "retry"
    return "generate"


async def retry_rewrite_query(state: GraphState) -> dict:
    """Only reached on the bounded retry path: ask the LLM to rephrase the
    query differently, in case the original phrasing just didn't match the
    corpus well, then mark flags["retried"] so should_retry can't loop again.
    """
    original = state["rewritten_query"]
    prompt = (
        "This search query returned weak results from a document search "
        "system: " + original + "\n\n"
        "Rephrase it as a different, more specific search query that might "
        "match better. Output only the rephrased query, nothing else."
    )
    rephrased = await acomplete(prompt)

    flags = dict(state.get("flags") or {})
    flags["retried"] = True
    return {"rewritten_query": rephrased or original, "flags": flags}


async def generate_answer(state: GraphState) -> dict:
    query = state["rewritten_query"]
    generation_chunks = select_chunks_for_generation(state["reranked"])
    answer = await agenerate(
        query,
        generation_chunks,
        formulation_category=state.get("formulation_category"),
        statutory_tags=state.get("statutory_tags"),
        formulation_notes=state.get("formulation_notes"),
    )

    flags = dict(state.get("flags") or {})
    # is_abstention() must run on the model's raw output, before the
    # disclaimer is appended — the disclaimer text doesn't start with
    # ABSTENTION_MARKER, so appending first would just be harmless, but
    # checking the raw answer first is the more obviously-correct order and
    # doesn't depend on that being true forever.
    flags["abstained"] = is_abstention(answer)

    # Post-generation grounding checks (not run on an abstention: there's no
    # "Section N"-shaped or "[chunk_id]"-shaped claim to verify in "I could
    # not find this in my sources"). Both are logged only, never surfaced in
    # the API response or used to edit `answer` — this project's citations
    # are only ever attached from real retrieved chunks, never parsed out of
    # or edited into the model's own text (see generation/citation.py's
    # docstring); an ungrounded reference here is a signal worth a human
    # looking at the prompt/retrieval for this query, surfaced the same way
    # weak_grounding's underlying warning already is.
    if not flags["abstained"]:
        ungrounded = find_ungrounded_references(answer, state["reranked"])
        if ungrounded:
            log.warning(
                "Answer references %s not found in any retrieved chunk's text — "
                "possible ungrounded statutory reference. Query: %r",
                ungrounded, query,
            )
        invalid_tags = find_invalid_inline_citation_tags(answer, state["reranked"])
        if invalid_tags:
            log.warning(
                "Answer's inline [chunk_id] tags %s don't match any retrieved "
                "chunk — model didn't follow the Chunk_ID rule. Query: %r",
                invalid_tags, query,
            )

    # formulation_notes only when not abstaining — same "no extra framing on
    # an abstention" rule actionable_forms/related_provisions already follow.
    notes = None if flags["abstained"] else state.get("formulation_notes")
    answer = append_formulation_notes(answer, notes)
    return {"answer": append_disclaimer(answer), "flags": flags}


def attach_citations_node(state: GraphState) -> dict:
    """No sources on an abstention — nothing was actually used to answer."""
    if (state.get("flags") or {}).get("abstained"):
        return {"citations": []}
    return {"citations": attach_citations(state["reranked"])}


def expand_related_provisions_node(state: GraphState) -> dict:
    """Knowledge-graph enrichment (graph_kg/kg.py) — deterministic, no I/O,
    no LLM call, same category as triage_formulation_node. Runs off the
    statutory tags actually carried by this query's retrieved chunks (not
    just the formulation category's own tag set, which is a coarser,
    query-level guess) so a related provision always traces back to what
    was genuinely retrieved for this specific question.

    No sources on an abstention, same reasoning as attach_citations_node:
    there's nothing retrieved that actually grounded an answer, so there's
    nothing to point onward from either. Never raises — related_provisions_for()
    degrades to [] on any missing/stale graph file, which this surfaces
    the same way (an empty list, not a missing key), so API callers never
    need a None check.
    """
    if (state.get("flags") or {}).get("abstained"):
        return {"related_provisions": []}

    chunk_tags = {
        tag
        for chunk in state.get("reranked") or []
        for tag in (chunk.get("statutory_tags") or [])
    }
    return {"related_provisions": related_provisions_for(sorted(chunk_tags))}


async def run_retrieval_stage(rewritten_query: str, jurisdiction: str) -> GraphState:
    """triage -> retrieve -> rerank -> bounded retry, composed from the same
    node functions the compiled graph uses for this exact sequence (see
    build_graph.py) — not a reimplementation of the retry threshold logic.

    Exists for api/main.py's SSE streaming endpoint. LangGraph nodes return
    a full state dict on completion; there's no clean way to have the graph
    itself yield partial output mid-node, and token streaming only matters
    for generation, not retrieval. So the streaming endpoint runs this
    helper directly, then streams generate_answer's underlying call itself,
    instead of going through compiled_graph.ainvoke() for the whole
    pipeline. The non-streaming /query endpoint still uses the real
    compiled graph end to end; this helper's output is identical to what
    that graph produces up through reranking, by construction.

    Returns the full working state (reranked, flags, formulation_category,
    statutory_tags, needs_clarification, clarifying_questions) rather than a
    positional tuple — that tuple grew twice already as fields were added
    (weak_grounding, then clarification) and a dict-like state is what
    every node here already produces and consumes, so the caller (api/
    main.py) reads named keys the same way a node would.
    """
    state: GraphState = {
        "rewritten_query": rewritten_query,
        "jurisdiction": jurisdiction,
        "flags": dict(DEFAULT_FLAGS),
    }
    state.update(triage_formulation_node(state))
    state.update(await retrieve(state))
    state.update(await rerank_node(state))

    if should_retry(state) == "retry":
        state.update(await retry_rewrite_query(state))
        state.update(await retrieve(state))
        state.update(await rerank_node(state))

    return state
