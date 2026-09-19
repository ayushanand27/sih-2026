#!/usr/bin/env python3
"""Run hallucination_trap cases (TRAP_01–TRAP_05) N times; write per-run + summary JSON."""

import asyncio
import json
import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
TRAP_GATE_OUT = (
    REPO_ROOT / "docs" / "work-session" / "artifacts" / "trap_gate"
)
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(override=True)

from scripts.evaluate_pipeline import (  # noqa: E402
    BENCHMARK_PATH,
    run_single_eval,
)


async def run_trap_gate(num_runs: int = 4) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
        all_cases = json.load(f)
    trap_cases = [c for c in all_cases if c.get("category") == "hallucination_trap"]
    trap_ids = [c["id"] for c in trap_cases]
    print(f"Trap gate: {len(trap_cases)} cases × {num_runs} runs — {trap_ids}\n")

    runs_payload = []
    for run_idx in range(1, num_runs + 1):
        print(f"=== Run {run_idx}/{num_runs} ===")
        results = []
        for tc in trap_cases:
            print(f"  {tc['id']}...", end="", flush=True)
            res = await run_single_eval(tc)
            results.append(res)
            flag = "PASS" if res["overall_pass"] else "FAIL"
            err = f" err={res.get('error', '')[:80]}" if res.get("error") else ""
            print(f" [{flag}] ({res['latency_ms']} ms){err}")

        abst_ok = sum(1 for r in results if r["abstained_correctly"])
        faith = (abst_ok / len(results)) * 100 if results else 0.0
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        run_doc = {
            "timestamp": ts,
            "run": run_idx,
            "metrics": {
                "trap_cases": len(results),
                "abstention_faithfulness_pct": round(faith, 2),
            },
            "results": results,
        }
        TRAP_GATE_OUT.mkdir(parents=True, exist_ok=True)
        out_path = TRAP_GATE_OUT / f"eval_report_trap_gate_run{run_idx}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(run_doc, f, indent=2)
        print(f"  faithfulness: {faith:.1f}% -> {out_path.relative_to(REPO_ROOT)}\n")
        runs_payload.append(run_doc)

    summary = {"generated": time.strftime("%Y-%m-%d %H:%M:%S"), "runs": runs_payload}
    summary_path = TRAP_GATE_OUT / "eval_report_trap_gate_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary -> {summary_path.resolve()}")


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    asyncio.run(run_trap_gate(n))
