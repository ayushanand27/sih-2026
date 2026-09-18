"""Diagnosis helper: TRAP_01 generation flake with fixed reranked chunks.

Loads top-5 reranked chunk IDs from scripts/debug_trap01_runs.json (run 1),
fetches chunk text from the DB, and calls the same generation path as the
graph without re-running retrieval.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(override=True)

from generation.citation import is_abstention
from generation.llm_client import agenerate
from generation.prompts import build_user_prompt, is_broad_query
from graph.formulation import CATEGORY_STATUTORY_TAGS, triage_formulation
from graph.nodes import generate_answer
from graph.state import DEFAULT_FLAGS
from retrieval.fusion import _fetch_metadata

TRAP_01_QUERY = (
    "Can I patent Paracetamol tablet formulations under the classical "
    "Ayurveda drug provisions?"
)
RUNS_JSON = BACKEND_ROOT / "scripts" / "debug_trap01_runs.json"
N_RUNS = 5


async def load_fixed_reranked() -> list[dict]:
    rows = json.loads(RUNS_JSON.read_text(encoding="utf-8"))
    run1 = rows[0]
    ids = run1["reranked_ids"]
    meta = await _fetch_metadata(ids)
    chunks: list[dict] = []
    for cid in ids:
        row = meta.get(cid)
        if not row:
            raise KeyError(f"chunk not in DB: {cid}")
        chunks.append({"chunk_id": cid, **row})
    return chunks


async def run_agenerate_loop(chunks: list[dict], triage: dict) -> list[dict]:
    category = triage["formulation_category"]
    tags = CATEGORY_STATUTORY_TAGS[category]
    notes = triage.get("formulation_notes") or []
    out: list[dict] = []
    for i in range(1, N_RUNS + 1):
        raw = await agenerate(
            TRAP_01_QUERY,
            chunks,
            formulation_category=category,
            statutory_tags=tags,
            formulation_notes=notes,
        )
        out.append(
            {
                "run": i,
                "path": "agenerate",
                "abstained": is_abstention(raw),
                "raw": raw,
            }
        )
    return out


async def run_generate_answer_loop(chunks: list[dict], triage: dict) -> list[dict]:
    category = triage["formulation_category"]
    tags = CATEGORY_STATUTORY_TAGS[category]
    state = {
        "rewritten_query": TRAP_01_QUERY,
        "reranked": chunks,
        "formulation_category": category,
        "statutory_tags": tags,
        "formulation_notes": triage.get("formulation_notes") or [],
        "flags": dict(DEFAULT_FLAGS),
    }
    out: list[dict] = []
    for i in range(1, N_RUNS + 1):
        result = await generate_answer(state)
        # generate_answer returns post-disclaimer answer; abstention flag set on raw
        abstained = result["flags"]["abstained"]
        out.append(
            {
                "run": i,
                "path": "generate_answer",
                "abstained": abstained,
                "raw": result["answer"],
            }
        )
    return out


def _print_table(rows: list[dict], label: str) -> None:
    print(f"\n=== {label} ({len(rows)} runs) ===")
    print(f"{'run':>4} | {'abstained':>9} | excerpt")
    print("-" * 80)
    for r in rows:
        excerpt = r["raw"].replace("\n", " ")[:120]
        print(f"{r['run']:>4} | {str(r['abstained']):>9} | {excerpt}...")


async def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    chunks = await load_fixed_reranked()
    triage = triage_formulation(TRAP_01_QUERY)
    print(f"Query: {TRAP_01_QUERY!r}")
    print(f"is_broad_query={is_broad_query(TRAP_01_QUERY)}")
    print(f"triage: {triage}")
    print(f"fixed reranked_ids ({len(chunks)}): {[c['chunk_id'] for c in chunks]}")

    user_prompt = build_user_prompt(
        TRAP_01_QUERY,
        chunks,
        triage["formulation_category"],
        CATEGORY_STATUTORY_TAGS[triage["formulation_category"]],
        triage.get("formulation_notes"),
    )
    print(f"user_prompt_chars={len(user_prompt)} (generation context only)")

    ag_rows = await run_agenerate_loop(chunks, triage)
    ga_rows = await run_generate_answer_loop(chunks, triage)
    _print_table(ag_rows, "agenerate (raw, pre-disclaimer)")
    _print_table(ga_rows, "generate_answer node (includes disclaimer)")

    abstain_rows = [r for r in ag_rows if r["abstained"]]
    answer_rows = [r for r in ag_rows if not r["abstained"]]
    if abstain_rows and answer_rows:
        print("\n--- Side-by-side: one abstain vs one answer (agenerate raw) ---")
        print("\n[ABSTAIN run", abstain_rows[0]["run"], "]\n", abstain_rows[0]["raw"])
        print("\n[ANSWER run", answer_rows[0]["run"], "]\n", answer_rows[0]["raw"])
    else:
        print(
            f"\nAll {N_RUNS} agenerate runs same abstained="
            f"{ag_rows[0]['abstained'] if ag_rows else '?'}"
        )

    out_path = BACKEND_ROOT / "scripts" / "debug_trap01_generation_results.json"
    payload = {
        "query": TRAP_01_QUERY,
        "triage": triage,
        "reranked_ids": [c["chunk_id"] for c in chunks],
        "agenerate": ag_rows,
        "generate_answer": ga_rows,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {out_path.name}")


if __name__ == "__main__":
    asyncio.run(main())
