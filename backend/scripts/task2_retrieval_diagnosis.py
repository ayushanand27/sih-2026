"""One-off retrieval diagnosis for benchmark failures (Task 2). Not part of CI."""
import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(override=True)

from generation.prompts import is_broad_query
from graph.nodes import (
    RERANK_SCORE_THRESHOLD,
    _fused_top_k,
    _rerank_top_k,
    retrieve,
    rerank_node,
    retry_rewrite_query,
)
from graph.state import GraphState

CASES = {
    "SEC3P_05": {
        "markers": ["3(p)", "3 (p)", "first schedule", "bhasma", "swarna"],
    },
    "BDA_04": {
        "markers": ["section 6", "form 3", "biological diversity rules", "nba"],
    },
    "BDA_05": {
        "markers": ["section 6", "access and benefit", "benefit sharing"],
    },
    "INTL_05": {
        "markers": ["patent cooperation treaty", " pct ", "pct)", "international application"],
    },
}


def _chunk_relevant(text: str, markers: list[str]) -> bool:
    low = (text or "").lower()
    return any(m in low for m in markers)


async def diagnose_case(case_id: str, query: str, jurisdiction: str, markers: list[str]):
    state: GraphState = {
        "query": query,
        "rewritten_query": query,
        "jurisdiction": jurisdiction,
        "history": [],
        "flags": {},
    }

    bm25_top = 5
    state.update(await retrieve(state))
    bm25_only = await asyncio.to_thread(
        __import__("retrieval.bm25_search", fromlist=["search"]).search,
        state["rewritten_query"],
        top_k=bm25_top,
        jurisdiction=jurisdiction,
    )
    bm25_hit = any(
        _chunk_relevant(r.get("text", ""), markers) for r in bm25_only if r.get("text")
    )
    # BM25 index returns ids only — fetch text via fuse path metadata
    from retrieval.fusion import _fetch_metadata

    bm25_ids = [r["chunk_id"] for r in bm25_only]
    meta = await _fetch_metadata(bm25_ids)
    for row in bm25_only:
        row.update(meta.get(row["chunk_id"], {}))
    bm25_hit = any(_chunk_relevant(r.get("text", ""), markers) for r in bm25_only)

    state.update(await rerank_node(state))
    reranked = state.get("reranked") or []
    top_ce = reranked[0]["rerank_score"] if reranked else 0.0

    retry_query = None
    second_ce = None
    if reranked and top_ce < RERANK_SCORE_THRESHOLD and not is_broad_query(query):
        retry_state = await retry_rewrite_query(state)
        retry_query = retry_state["rewritten_query"]
        state2: GraphState = {
            **state,
            "rewritten_query": retry_query,
            "flags": retry_state["flags"],
        }
        state2.update(await retrieve(state2))
        state2.update(await rerank_node(state2))
        r2 = state2.get("reranked") or []
        second_ce = r2[0]["rerank_score"] if r2 else 0.0

    return {
        "case_id": case_id,
        "original_query": query,
        "retrieval_query_pass1": state["rewritten_query"],
        "broad_query_pool": is_broad_query(query),
        "fused_top_k": _fused_top_k(query),
        "bm25_top5_right_chunk": bm25_hit,
        "bm25_top5": [
            {
                "score": round(r["score"], 2),
                "chunk_id": r["chunk_id"],
                "source": r.get("source_file"),
                "relevant": _chunk_relevant(r.get("text", ""), markers),
            }
            for r in bm25_only
        ],
        "ce_top_score_pass1": round(top_ce, 4),
        "retry_retrieval_query": retry_query,
        "ce_top_score_pass2": round(second_ce, 4) if second_ce is not None else None,
        "rerank_top5_pass1": [
            {
                "ce": round(r["rerank_score"], 4),
                "chunk_id": r["chunk_id"],
                "source": r.get("source_file"),
                "heading": (r.get("section_heading") or "")[:60],
            }
            for r in reranked
        ],
    }


async def main():
    bench = json.loads((BACKEND_ROOT / "data" / "eval_benchmark.json").read_text())
    by_id = {c["id"]: c for c in bench}
    out = []
    for case_id, cfg in CASES.items():
        tc = by_id[case_id]
        out.append(
            await diagnose_case(
                case_id, tc["query"], tc["jurisdiction"], cfg["markers"]
            )
        )
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
