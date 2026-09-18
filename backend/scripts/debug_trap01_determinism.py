"""Debug TRAP_01 retrieval path: chunk IDs pre/post rerank across N runs."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(override=True)

from generation.prompts import is_broad_query
from graph.nodes import _fused_top_k, _rerank_top_k, rerank_node
from retrieval.bm25_search import search as bm25_search
from retrieval.dense_search import search as dense_search
from retrieval.fusion import fuse
from retrieval.reranker import rerank as rerank_sync

TRAP_01_QUERY = (
    "Can I patent Paracetamol tablet formulations under the classical "
    "Ayurveda drug provisions?"
)
JURISDICTION = "india"
RUNS = 8


async def one_run(run_idx: int) -> dict:
    fused_k = _fused_top_k(TRAP_01_QUERY)
    rerank_k = _rerank_top_k(TRAP_01_QUERY)

    bm25 = await asyncio.to_thread(
        bm25_search, TRAP_01_QUERY, top_k=fused_k, jurisdiction=JURISDICTION
    )
    dense = await dense_search(TRAP_01_QUERY, top_k=fused_k, jurisdiction=JURISDICTION)
    fused = await fuse(
        bm25, dense, top_k=fused_k, jurisdiction=JURISDICTION
    )
    reranked = await asyncio.to_thread(
        rerank_sync, TRAP_01_QUERY, fused, top_k=rerank_k
    )

    return {
        "run": run_idx + 1,
        "bm25_ids": [r["chunk_id"] for r in bm25],
        "dense_ids": [r["chunk_id"] for r in dense],
        "fused_ids": [r["chunk_id"] for r in fused],
        "reranked_ids": [r["chunk_id"] for r in reranked],
        "reranked_top1": (
            {
                "chunk_id": reranked[0]["chunk_id"],
                "rerank_score": reranked[0]["rerank_score"],
                "raw_logit": reranked[0].get("raw_logit"),
            }
            if reranked
            else None
        ),
    }


def _set_sig(rows: list[dict], key: str) -> list[frozenset]:
    return [frozenset(r[key]) for r in rows]


async def main() -> None:
    print(f"Query: {TRAP_01_QUERY!r}")
    print(f"jurisdiction={JURISDICTION} broad_query={is_broad_query(TRAP_01_QUERY)}")
    print(f"fused_top_k={_fused_top_k(TRAP_01_QUERY)} rerank_top_k={_rerank_top_k(TRAP_01_QUERY)}")
    print(f"Runs: {RUNS}\n")

    rows = []
    for i in range(RUNS):
        rows.append(await one_run(i))

    for r in rows:
        print(
            f"Run {r['run']:2d} | bm25={len(r['bm25_ids'])} dense={len(r['dense_ids'])} "
            f"fused={len(r['fused_ids'])} | top1={r['reranked_top1']}"
        )

    print("\n--- Set stability (identical across all runs?) ---")
    for stage in ("bm25_ids", "dense_ids", "fused_ids", "reranked_ids"):
        sigs = _set_sig(rows, stage)
        unique = len(set(sigs))
        print(f"  {stage}: {unique} unique set(s) over {RUNS} runs")
        if unique > 1:
            for i, s in enumerate(sigs):
                if s != sigs[0]:
                    only_here = s - sigs[0]
                    only_baseline = sigs[0] - s
                    print(f"    run {i+1} diff +{len(only_here)} -{len(only_baseline)} vs run1")

    print("\n--- Ordered top-5 fused (run 1 vs last) ---")
    print("run1:", rows[0]["fused_ids"][:5])
    print(f"run{RUNS}:", rows[-1]["fused_ids"][:5])

    print("\n--- Ordered reranked (all runs, top-3) ---")
    for r in rows:
        top3 = r["reranked_ids"][:3]
        print(f"  run {r['run']}: {top3}")

    out_path = BACKEND_ROOT / "scripts" / "debug_trap01_runs.json"
    out_path.write_text(json.dumps(rows, indent=2))
    print(f"\nWrote {out_path.name}")


if __name__ == "__main__":
    asyncio.run(main())
