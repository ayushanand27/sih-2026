# IP-SAKTI Sahayak

Smart India Hackathon 2026, problem statement **SIH26045**, Ministry of Ayush.

IP-SAKTI Sahayak is a source-cited AI assistant for questions about
Intellectual Property and regulatory rules relevant to Ayurveda in India. A
user asks a question; the system retrieves relevant text from a fixed set of
official government documents and answers using only that text, showing
which document, page, and section each part of the answer came from. If the
answer isn't in the indexed documents, it says so instead of guessing.

Scope is the national (Indian) IP/regulatory framework only. International
regimes are out of scope for this build.

## Why the architecture is what it is

Independent evaluations of commercial legal AI tools found hallucination
rates of 17–33% even with retrieval-augmented generation in place. In a
regulatory domain, a confidently wrong answer is worse than no answer. Four
decisions follow from that — full reasoning is in [idea.md](idea.md):

1. **Hybrid retrieval** (BM25 + dense embeddings, fused by Reciprocal Rank
   Fusion) instead of dense-only, because legal text needs exact matching on
   section numbers and statutory terms, not just semantic similarity.
2. **Cross-encoder reranking** to re-score candidates for actual relevance
   before anything reaches the LLM.
3. **Programmatic citations** — the LLM never writes a citation. The code
   tracks which chunks were actually retrieved and attaches their source
   file, page, and section directly. A citation cannot be hallucinated if the
   model never generates it.
4. **Abstention guardrail** — if the retrieved context doesn't contain the
   answer, the system says so explicitly and asks a clarifying question,
   rather than filling the gap from the model's general knowledge.

Orchestration is a **deterministic LangGraph DAG**, not an autonomous agent
loop — a fixed sequence of nodes with one bounded conditional retry, not
unbounded cycles.

## Pipeline

```
User query
  → Query rewriter        (standalone question, using chat history if any)
  → Hybrid retrieval       BM25 + dense embeddings, merged by RRF   → top 20
  → Cross-encoder reranker                                          → top 5
  → Grounded generation    (LLM, retrieved text only, no outside knowledge)
  → Citation attacher      (code-attached from retrieved chunks, not the LLM)
  → Answer + sources   —or—   Abstains, with one clarifying question
```

One bounded exception to the straight-line flow: if the top rerank score is
weak, the graph retries retrieval once with a reworded query before giving
up and generating an answer (or abstaining). Never more than one retry.

## Tech stack

| Layer | Choice |
|---|---|
| Orchestration | LangGraph (deterministic DAG) |
| API | FastAPI |
| Sparse retrieval | rank_bm25 (BM25Okapi) |
| Dense retrieval | sentence-transformers, `all-MiniLM-L6-v2` (384 dims) |
| Vector store | pgvector on Postgres (Neon, in this deployment) |
| Reranker | cross-encoder, `ms-marco-MiniLM-L-6-v2`, run locally |
| LLM primary | Ollama (local) — wired in, currently not working, see below |
| LLM fallback | Groq API — currently the backend's actual, working path |
| Frontend | Not built here (see Current status) |

## Repo layout

```
├── idea.md                 Standing project context / architecture rationale
├── PROJECT_GUIDE.md        Original team build plan
├── README.md               This file
├── docs/
│   └── API_CONTRACT.md    Backend HTTP interface, for frontend integration
├── data/                   Source PDFs (gitignored — see Document corpus)
└── backend/
    ├── ingestion/          loader.py, chunker.py, indexer.py
    ├── retrieval/          bm25_search.py, dense_search.py, fusion.py, reranker.py
    ├── generation/         prompts.py, llm_client.py, citation.py
    ├── graph/              state.py, nodes.py, build_graph.py
    ├── api/                main.py
    ├── requirements.txt
    └── env.example.txt
```

## Setup

```bash
git clone https://github.com/ayushanand27/sih-2026.git
cd sih-2026/backend

python -m venv .venv
.venv\Scripts\activate          # Windows; `source .venv/bin/activate` on Mac/Linux
pip install -r requirements.txt

cp env.example.txt .env
```

Fill in `.env`:
- `DATABASE_URL` — a Postgres connection string with the `pgvector` extension
  available (a free Neon or Supabase project works). The indexer runs
  `CREATE EXTENSION IF NOT EXISTS vector;` itself on first connect; if your
  provider restricts that for app-level connections, run it once yourself in
  their SQL editor.
- `GROQ_API_KEY` — free tier at [console.groq.com](https://console.groq.com).
  **Check `GROQ_MODEL` against your own key's access** — model availability
  varies by account; `client.models.list()` shows what's actually usable.
  `openai/gpt-oss-120b` is confirmed working as of this writing.
- Everything else has a working default — see `env.example.txt` for what
  each variable does.

Put source PDFs in `data/` at the repo root (sibling of `backend/`, not
inside it). Filenames matter: they're shown to the user as the citation
source, so name them for what they are (`GI_Act_1999.pdf`, not `doc1.pdf`).

Then, from `backend/`:
```bash
python -m ingestion.indexer --reset
```
This loads every PDF in `data/`, chunks it, embeds it into pgvector, and
builds the BM25 index. It fails loudly (not silently) if any chunk is
missing citation metadata — that's deliberate, since every downstream
citation depends on it.

## Running things

All commands below are run from `backend/`, with the venv active.

**Test retrieval alone** (prints BM25 / dense / fused / reranked results
side by side for one query):
```bash
python -m retrieval "Section 3(p) traditional knowledge"
```

**Test generation end to end** (retrieval → LLM → answer + citations,
printed to the terminal):
```bash
python -m generation "What does Section 3(p) say about traditional knowledge?"
```

**Run the full LangGraph pipeline** directly (same result as `/query`, no
HTTP layer):
```bash
python -m graph "What does Section 3(p) say about traditional knowledge?"
```

**Run the API:**
```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
Then `GET /health`, `POST /query`, `POST /ingest`. Full request/response
shapes, real example responses, and timing expectations are in
[docs/API_CONTRACT.md](docs/API_CONTRACT.md) — that's the source of truth
for frontend integration, not this file.

## Current status

**Done:**
- Ingestion (PDF loading, chunking with citation metadata, dual indexing
  into pgvector + BM25)
- Hybrid retrieval (BM25 + dense, fused by RRF) with reranking
- Grounded generation with programmatic citation attachment and a verified
  abstention guardrail
- LangGraph DAG wiring the above into one deterministic pipeline, with a
  bounded single retry on weak retrieval
- FastAPI layer (`/query`, `/health`, `/ingest`), tested against a live
  running server

**Not yet built:**
- Frontend — being handled by a teammate against `docs/API_CONTRACT.md`
- Multilingual support (Bhashini) — deferred per the original build plan,
  English-only for now
- Deployment — everything above has only been run locally

**Known limitation, stated plainly:** the architecture calls for a local
Ollama model as the primary LLM (so the system keeps working if venue WiFi
fails), with Groq as a fallback. Ollama is wired into the code and will be
tried first on every request, but on the current dev machine its GPU path
crashes on start (a CUDA driver/runtime mismatch), so every request
currently times out against Ollama and falls back to Groq. **In its present
state, the demo depends on internet access to reach Groq** — the offline
path is implemented but not currently functional on this hardware. This
also means typical response times are slower than they should be (real
measured range: ~29s for a normal query, ~54s for a query that triggers the
system's internal retry), since each request pays the Ollama timeout before
Groq is tried. Fixing the CUDA issue (or running on different hardware) is
the actual fix; the current timeout tuning is a mitigation, not a solution.

## Document corpus

The system can only answer from what's actually indexed. As of this
writing, `data/` contains 9 PDFs, 1019 chunks total:

| Document | What it is |
|---|---|
| `Patents_Act_1970.pdf` | The Patents Act, 1970 (as amended) — includes Section 3(p), the traditional-knowledge non-patentability provision |
| `Manual_of_Patent_Office_Practice_and_Procedure.pdf` | CGPDTM's Manual of Patent Office Practice and Procedure, including its worked explanation of Section 3(p) |
| `IPO_Guidelines_Traditional_Knowledge_and_Biological_Material.pdf` | IP India's guidelines for examining patent applications involving traditional knowledge or biological material |
| `GI_Act_1999.pdf` | The Geographical Indications of Goods (Registration and Protection) Act, 1999 |
| `New_Drugs_and_Clinical_Trials_Rules_2019.pdf` | The New Drugs and Clinical Trials Rules, 2019 (CDSCO) |
| `National_IPR_Policy_2016.pdf` | National IPR Policy, 2016 |
| `Jan_Vishwas_Amendment_of_Provisions_Act_2023.pdf` | Jan Vishwas (Amendment of Provisions) Act, 2023 — decriminalizes minor offences across several Acts, including IP statutes |
| `Documenting_Traditional_Knowledge_EACPM.pdf` | EACPM report on documenting traditional knowledge |
| `PIB_TKDL_Factsheet.pdf` | PIB factsheet on the Traditional Knowledge Digital Library (TKDL) |

Questions outside what these documents cover — including questions about
international IP regimes, or anything unrelated to Indian IP/Ayurveda
regulation — are expected to trigger the abstention guardrail, not a
guessed answer. That's the intended behavior, not a gap to route around.
