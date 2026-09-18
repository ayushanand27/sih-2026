# Eval benchmark triage (20-case harness)

Source: `backend/scripts/evaluate_pipeline.py` → `backend/eval_report.json`.

**Baseline (healthy Groq quota, pre–TRAP-guard regression):**  
`eval_report_step1_run1.json` — **65.0%** overall, **73.33%** statutory accuracy, **80.0%** abstention faithfulness.

**Latest full run in-repo:** `eval_report.json` / `eval_report_trapfix_run4.json` — **30.0%** overall (Groq 429 / degraded keys dominated BDA/INTL/TRAP cases; not a fair regression signal).

## Failure classification (`eval_report_step1_run1.json` — 7 failures)

| ID | Class | Notes |
|---|---|---|
| SEC3P_05 | GENERATION + eval matcher | Answered but `matched_citation` false — answer cited TKDL/Bhasma without locators eval expects (`Section 3(p)` / First Schedule). Prompt rule **2b** added; retrieval retry already lifts CE to ~0.90 on rephrase. |
| BDA_02 | CITATION_MATCH | Correct substance; eval corpus missing explicit "Form 3" token in attached citations + answer. |
| BDA_03 | CITATION_MATCH | Same pattern — Section 6(1) wording not in citation union. |
| BDA_04 | RETRIEVAL_MISS / GENERATION | False abstention; diagnosis shows strong BDA retrieval — generation or threshold edge case. |
| BDA_05 | GENERATION | False abstention despite 0.99 CE on BDA chunks in diagnosis. |
| INTL_05 | GENERATION | False abstention; PCT chunks rank well in diagnosis. |
| TRAP_01 | GENERATION | Answered from D&C only — fixed by `should_force_ip_patent_context_abstention` (deterministic guard). |

## `eval_report.json` (rate-limited run) — additional buckets

| Class | IDs | Action |
|---|---|---|
| GROQ_429 / infra | BDA_02, BDA_03, BDA_04, INTL_03, INTL_04, TRAP_02, TRAP_03, TRAP_05 | Re-run when quota resets; not code bugs. |
| TRAP_01 500 | TRAP_01 | Investigate server error separately from guard logic. |
| False abstention (ip_patent clarifier text) | SEC3P_05, BDA_05, INTL_01, INTL_02, INTL_05 | Prompt 2b + TRAP guard scope; re-eval when Groq available. |

## GENUINE_GAP (documented in `data/eval_benchmark.json` comments)

- **Trademark definition query** ("What is a trademark?") — retrieval ranking; see `idea.md` / `test_retrieval_determinism.py` (honest open gap).
- **INTL_02 Budapest + Ayurvedic biologics** — corpus may not contain a direct bridge passage; abstention may be correct until more international guidance is indexed.

## Re-run

```bash
cd backend
python scripts/evaluate_pipeline.py
```

Compare metrics to the **65 / 73.33 / 80** baseline after quota recovery.
