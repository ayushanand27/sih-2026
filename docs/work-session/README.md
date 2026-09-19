# Work session checkpoint (handoff)

Open this folder first when continuing IP-SAKTI work on another machine after `git pull`.
It holds **measurement artifacts only** — not secrets (`.env` stays local).

## Where the code is

| Area | Location |
|------|----------|
| Main app | `backend/`, `frontend/` |
| Architecture rules | `idea.md` |
| Eval benchmark (20 cases) | `backend/data/eval_benchmark.json` |
| Failure triage notes | `docs/EVAL_TRIAGE.md` |
| Official harness output (default) | `backend/eval_report.json` |

## GitHub `main` (pushed)

Recent commits include: TRAP_01 guard (`765d4b3`), retry rewrite seed (`4d7b6d5`), eval triage docs (`aa77335`), KG `second_hop` (`c3eec92`), frontend smoke tests (`688a896`), quota-aware test skip (`255f8f8`).

## Done vs still open

**Done (in repo):** Hybrid RAG pipeline, programmatic citations, LangGraph DAG, Bhashini/Sarvam translation, auth + Docker, offline eval harness, `run_trap_gate.py`, pytest suite (~108 tests when Groq quota is available).

**Not finished / not proven:**

1. **4× trap gate at 100%** on TRAP_01–TRAP_05 — see `artifacts/trap_gate/` (last run **40%** faithfulness; TRAP_02/03/05 often failed with Groq **503/429**, not logic).
2. **Fresh full 20-case eval** after latest fixes — committed baseline in `artifacts/baseline/` mirrors `backend/eval_report.json` (**30% / 46.67% / 20%** as of 2026-09-18).
3. **Task 6** statutory tag coverage pass (572/2907 chunks tagged) — not started.
4. **Deployment** — explicitly out of scope for this checkpoint.

## Artifacts in this folder

```
artifacts/
  baseline/           snapshot of last committed eval_report.json
  trap_gate/          4-run TRAP-only gate + summary JSON
  step1_multirun/     4 full eval runs (step1 / retry determinism work)
  trapfix_multirun/   4 full eval runs (TRAP fix attempts)
  debug/              TRAP_01 debug JSON from scripts/
  language_probe_report.json
```

## Commands to resume

From `backend/` with venv active and `.env` filled:

```powershell
python -m pytest -v
python scripts/evaluate_pipeline.py
python scripts/run_trap_gate.py 4
```

Trap gate writes new JSON under `docs/work-session/artifacts/trap_gate/`.

## Teammate setup (short)

1. `git clone https://github.com/ayushanand27/sih-2026.git`
2. Copy PDFs into repo-root `data/` (not in git).
3. `backend`: venv, `pip install -r requirements.txt`, copy `env.example.txt` → `.env`.
4. Index: `python -m ingestion.indexer --reset` then `python -m graph_kg.build_kg`.
5. Run API: `python run.py`; frontend: `npm install` + `npm run dev`.

Share API keys (Groq, DB, Bhashini) out of band.
