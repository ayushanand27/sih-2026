#!/usr/bin/env python3
"""
IP-SAKTI Sahayak (SIH26045) - RAGAS Faithfulness/Relevancy Evaluation

A second, complementary report to scripts/evaluate_pipeline.py, not a
replacement for it. evaluate_pipeline.py measures whether the *right*
citation was found (keyword match against expected_statutes) and whether
abstention fired when it should have. This script measures a different,
narrower thing RAGAS is actually built for: given the real answer this
system generated and the real chunk text it retrieved to back that answer,
is every claim in the answer actually supported by that text (Faithfulness),
and does the answer actually address the question asked (ResponseRelevancy)?
Faithfulness in particular is a direct, independent, numeric check of
idea.md's central architectural claim -- "answer only from retrieved text,
never fill a gap from model knowledge" -- computed by a judge model that
never saw this system's own prompt or its "don't hallucinate" instruction,
which is the point: it's an outside check, not the system grading its own
homework.

Wired to api.main.run_query() -- same real entrypoint evaluate_pipeline.py
uses, not a reimplementation of retrieval/generation. See that script's own
docstring for the exact run_query() call shape and why (language="en-IN",
no bare "en"; abstention read from response.flags.abstained, not string-
sniffed).

Why Groq, not RAGAS's OpenAI default: this project has no OpenAI dependency
anywhere else, and grading this system's Groq-generated answers with a
different vendor's model would mean the "faithfulness judge" and the
"answer generator" never had a comparable footing to begin with -- swapping
in a paid OpenAI dependency this project doesn't otherwise carry, for a
weaker reason than just reusing what's already configured. ChatGroq reads
generation/llm_client.py's own GROQ_MODEL env var (default
"openai/gpt-oss-120b", despite the name -- see that file), so the eval
judge and the answer-generation LLM are the same model, configured in the
same one place. Embeddings the same way: HuggingFaceEmbeddings wraps the
identical sentence-transformers model ingestion/indexer.py::EMBED_MODEL
already loads for retrieval -- one model name, one place it's read from.

Why only Faithfulness + ResponseRelevancy, not the reference-based RAGAS
metrics (ContextPrecision, ContextRecall, AnswerCorrectness, ...): those
require a `reference`/`ground_truth` field -- a human-verified correct
answer to score the real answer against. data/eval_benchmark.json has no
such field (id, query, category, jurisdiction, expected_statutes,
should_abstain only -- confirmed by reading the file directly, not assumed).
Writing one from this script's own "knowledge" of patent/biodiversity law
would be exactly the fabrication idea.md says this whole architecture exists
to prevent, and it would make those scores measure agreement with an
invented reference, not correctness. If reference-based scoring is wanted,
eval_benchmark.json needs human-authored ground_truth fields added first --
that's a decision for a domain reviewer, not something this script invents.

Why abstained queries are excluded from Faithfulness/ResponseRelevancy: both
metrics need a real `response` to score -- there's no "faithfulness of
nothing" to compute for a query this system correctly declined to answer.
Those cases are already scored by evaluate_pipeline.py's abstention check;
this script reports the same should_abstain pass/fail for them (no
duplicate LLM judging) so the console table still accounts for every
benchmark entry, just via the metric that actually applies to it.

Separate output file: this writes backend/ragas_report.json, and never
touches backend/eval_report.json (evaluate_pipeline.py's own output) --
two complementary reports over the same benchmark, not one replacing the
other.

Dependency note (see backend/requirements-eval.txt): ragas + langchain-groq
+ langchain-huggingface are NOT in backend/requirements.txt and must not be
installed into the same environment as the rest of this backend. ragas
0.4.3 (and 0.3.9, the previous minor -- both checked) pulls in
langchain-core>=1.x, which hard-conflicts with this project's own pinned
langgraph==0.2.60 / langchain-core==0.3.28 that graph/build_graph.py is
written and tested against -- confirmed by actually installing both
combinations and watching langchain_groq's own import break under the
older pin. Run this script from a separate venv:
    python -m venv .venv-eval
    .venv-eval/Scripts/pip install -r requirements.txt -r requirements-eval.txt
    .venv-eval/Scripts/python scripts/evaluate_ragas.py

Usage (from backend/, the eval venv active):
    python scripts/evaluate_ragas.py
    python -m scripts.evaluate_ragas
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

# backend/ on sys.path, matching scripts/evaluate_pipeline.py's own comment:
# this file lives at backend/scripts/, so its own parent's parent is
# backend/, not the repo root.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
from tabulate import tabulate

load_dotenv(override=True)

from api.main import run_query  # noqa: E402 -- must follow the sys.path insert above
from generation.llm_client import GROQ_MODEL  # noqa: E402
from ingestion.indexer import EMBED_MODEL  # noqa: E402

try:
    from langchain_groq import ChatGroq
    from langchain_huggingface import HuggingFaceEmbeddings
    from ragas import EvaluationDataset, SingleTurnSample, evaluate
    from ragas.metrics import Faithfulness, ResponseRelevancy
except ImportError as exc:  # pragma: no cover - environment-dependent
    print(
        "Could not import ragas/langchain-groq/langchain-huggingface.\n"
        f"Real error: {exc!r}\n\n"
        "This script must run from the separate eval venv described in its "
        "own docstring and backend/requirements-eval.txt, not backend/.venv "
        "-- installing these packages into the main venv conflicts with "
        "this project's pinned langgraph/langchain-core (see "
        "requirements-eval.txt for the exact conflict)."
    )
    sys.exit(1)

# data/ lives under backend/, not at the repo root -- see
# evaluate_pipeline.py's own comment on this same path (c230ea9 moved it
# there; a REPO_ROOT-based path silently pointed at a nonexistent file).
BENCHMARK_PATH = BACKEND_ROOT / "data" / "eval_benchmark.json"
REPORT_PATH = BACKEND_ROOT / "ragas_report.json"


async def run_single_query(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Runs one benchmark entry through the real live pipeline (real DB,
    real LLM -- same run_query() /query itself calls) and extracts exactly
    what RAGAS needs: the question, the real generated answer, and the real
    retrieved chunk text backing it (Citation.text -- see api/main.py's
    Citation model docstring: "the actual chunk text retrieved and given to
    the LLM, verbatim from the source PDF" -- confirmed carried on the
    response, not reconstructed from citation metadata)."""
    query = test_case["query"]
    jurisdiction = test_case.get("jurisdiction", "india")
    should_abstain = test_case.get("should_abstain", False)

    response = await run_query(
        question=query,
        history=[],
        jurisdiction=jurisdiction,
        language="en-IN",
        synthesize_audio=False,
    )
    abstained = response.flags.abstained

    return {
        "id": test_case["id"],
        "query": query,
        "should_abstain": should_abstain,
        "actual_abstained": abstained,
        "abstained_correctly": abstained == should_abstain,
        "answer": response.answer or "",
        "contexts": [c.text for c in response.citations],
    }


async def collect_results(test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results = []
    for idx, test_case in enumerate(test_cases, 1):
        print(
            f"Running [{idx:02d}/{len(test_cases)}]: {test_case['id']}...",
            end="",
            flush=True,
        )
        res = await run_single_query(test_case)
        results.append(res)
        tag = "ABSTAINED" if res["actual_abstained"] else "ANSWERED"
        print(f" [{tag}]")
    return results


def build_evaluation_dataset(results: List[Dict[str, Any]]) -> EvaluationDataset:
    """Only non-abstained entries have a response to score Faithfulness/
    ResponseRelevancy against -- see module docstring."""
    samples = [
        SingleTurnSample(
            user_input=r["query"],
            response=r["answer"],
            retrieved_contexts=r["contexts"] or [""],
        )
        for r in results
        if not r["actual_abstained"]
    ]
    return EvaluationDataset(samples=samples)


async def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if not BENCHMARK_PATH.exists():
        print(f"Error: Benchmark file not found at {BENCHMARK_PATH}")
        sys.exit(1)

    with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    print("\n=======================================================")
    print("   IP-SAKTI Sahayak: RAGAS Faithfulness/Relevancy Run   ")
    print(f"   Judge LLM: {GROQ_MODEL} (Groq)")
    print(f"   Embeddings: {EMBED_MODEL}")
    print(f"   Target Corpus: {len(test_cases)} Curated Statutory Cases")
    print("=======================================================\n")

    results = await collect_results(test_cases)

    abstained_results = [r for r in results if r["actual_abstained"]]
    scored_results = [r for r in results if not r["actual_abstained"]]

    ragas_scores: Dict[str, List[float]] = {}
    if scored_results:
        dataset = build_evaluation_dataset(scored_results)
        llm = ChatGroq(model=GROQ_MODEL)
        embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)

        eval_result = evaluate(
            dataset,
            metrics=[Faithfulness(), ResponseRelevancy()],
            llm=llm,
            embeddings=embeddings,
        )

        # eval_result.scores is a public list of per-row {metric: score}
        # dicts, same row order as `dataset` -- see ragas.dataset_schema.
        # EvaluationResult. Zipped back onto scored_results by position
        # rather than reading the private _repr_dict aggregate.
        for row, scores in zip(scored_results, eval_result.scores):
            row["faithfulness"] = scores.get("faithfulness")
            row["response_relevancy"] = scores.get("answer_relevancy")

        for metric_key in ("faithfulness", "response_relevancy"):
            values = [
                r[metric_key] for r in scored_results if r.get(metric_key) is not None
            ]
            if values:
                ragas_scores[metric_key] = values

    def mean(values: List[float]) -> float:
        return sum(values) / len(values) if values else float("nan")

    mean_faithfulness = mean(ragas_scores.get("faithfulness", []))
    mean_relevancy = mean(ragas_scores.get("response_relevancy", []))

    abstention_correct = sum(1 for r in abstained_results if r["abstained_correctly"])
    # Non-abstained rows can still have gotten should_abstain wrong (i.e.
    # answered when it should have abstained) -- counted here too, same
    # "every benchmark entry accounted for" rule as evaluate_pipeline.py.
    abstention_correct += sum(1 for r in scored_results if r["abstained_correctly"])
    abstention_total = len(results)
    abstention_accuracy = (
        (abstention_correct / abstention_total) * 100 if abstention_total else 0.0
    )

    table_rows = [
        [
            r["id"],
            (r["query"][:45] + "...") if len(r["query"]) > 45 else r["query"],
            "ABSTAINED" if r["actual_abstained"] else "ANSWERED",
            "YES" if r["abstained_correctly"] else "NO",
            f"{r['faithfulness']:.3f}" if r.get("faithfulness") is not None else "-",
            (
                f"{r['response_relevancy']:.3f}"
                if r.get("response_relevancy") is not None
                else "-"
            ),
        ]
        for r in results
    ]
    headers = [
        "Case ID",
        "Query Preview",
        "Outcome",
        "Abstain OK",
        "Faithfulness",
        "Relevancy",
    ]
    print("\n" + tabulate(table_rows, headers=headers, tablefmt="fancy_grid"))

    print("\n---------------- RAGAS SUMMARY METRICS ----------------")
    print(f"Cases scored (answered, not abstained) : {len(scored_results)}")
    print(f"Cases excluded (abstained)              : {len(abstained_results)}")
    print(f"Mean Faithfulness                       : {mean_faithfulness:.3f}")
    print(f"Mean Response Relevancy                 : {mean_relevancy:.3f}")
    print(f"Abstention Correctness (all cases)      : {abstention_accuracy:.1f}%")
    print("---------------------------------------------------------\n")

    output_report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "judge_llm": GROQ_MODEL,
        "embeddings_model": EMBED_MODEL,
        "metrics": {
            "cases_scored": len(scored_results),
            "cases_excluded_abstained": len(abstained_results),
            "mean_faithfulness": (
                None if mean_faithfulness != mean_faithfulness else mean_faithfulness
            ),
            "mean_response_relevancy": (
                None if mean_relevancy != mean_relevancy else mean_relevancy
            ),
            "abstention_correctness_pct": round(abstention_accuracy, 2),
        },
        "results": results,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(output_report, f, indent=2)

    print(f"Full RAGAS report saved to {REPORT_PATH.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
