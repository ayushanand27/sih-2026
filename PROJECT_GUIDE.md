# SIH26045 — IP-SAKTI Sahayak
## Master Build Document

Put this file in the project root as `PROJECT_GUIDE.md`. Everyone reads this before writing any code.

**PS Number:** SIH26045
**Title:** IP-SAKTI Sahayak — a multilingual, RAG-based (source-cited) AI assistant for Intellectual Property and regulatory guidance in Ayurveda
**Ministry:** Ministry of Ayush
**Category:** Software

---

# PART A — WHAT WE'RE BUILDING

An AI assistant that answers questions about Ayurveda-related IP and regulatory rules by retrieving text from official government documents and showing exactly which document and section each part of the answer came from.

**Prototype scope:** National (Indian) framework only. International IP regimes go in the "future work" slide.

## Why our architecture beats a basic RAG chatbot

Most teams will build: embed query → fetch top-k chunks → feed to LLM → done. That has a measured failure rate. Independent evaluations of commercial legal AI tools (LexisNexis, Thomson Reuters) found hallucination rates of 17–33% even with RAG in place. In a regulatory domain, a confidently wrong answer is worse than no answer.

We add four things basic RAG does not have:

1. **Hybrid retrieval** — BM25 (keyword) + dense embeddings (semantic), fused via Reciprocal Rank Fusion. Benchmarks show this beats either alone. Critical here because legal text needs exact section-number and term matching, not just "similar meaning."

2. **Cross-encoder reranking** — re-scores retrieved candidates for actual relevance before they reach the LLM.

3. **Programmatic citations** — the single most important design decision. The LLM never writes the citation. Our code tracks which chunks were retrieved (with source filename + page + section) and attaches those. A citation cannot be hallucinated if the model never generates it.

4. **Abstention guardrail** — if the retrieved context doesn't contain the answer, the system says "not in my sources" and asks a clarifying question instead of guessing. This also protects us live if a judge asks something out of scope.

**Orchestration:** LangGraph as a **deterministic DAG**, not a fully autonomous agent loop. LangGraph is the most mature orchestration framework available, but autonomous agentic loops are hard to debug, non-deterministic, and give the same answer as simpler pipelines on straightforward factual queries at several times the cost. A fixed graph gives us the architecture sophistication without the debugging risk.

## Architecture

```
User Query
    ↓
[Node 1] Query Rewriter — makes the question standalone using chat history
    ↓
[Node 2] Hybrid Retriever — BM25 + dense embeddings, fused with RRF
    ↓
[Node 3] Cross-Encoder Reranker — re-scores candidates, keeps top 5
    ↓
[Node 4] Grounded Generator — LLM answers using ONLY retrieved chunks
    ↓
[Node 5] Citation Attacher + Verifier — attaches real source metadata, flags unsupported claims
    ↓
Final Answer + Source List
```

---

# PART B — SOURCE DOCUMENTS TO DOWNLOAD

Download these as PDFs into the `data/` folder. **Name each file clearly** — the filename appears in the citation shown to users.

### Primary portals to pull from

| Source | URL | What to get |
|---|---|---|
| Ministry of AYUSH (main site) | https://main.ayush.gov.in | Circulars, orders, IP/traditional knowledge policy documents, Acts & Rules section |
| Indian Patent Office (IP India) | https://ipindia.gov.in | Patent guidelines, especially traditional knowledge / biological material provisions |
| IP India — Patent Manual & Guidelines | https://ipindia.gov.in/guidelines-patents.htm | Manual of Patent Office Practice and Procedure; guidelines on traditional knowledge |
| Geographical Indications Registry | https://ipindia.gov.in/gi.htm | GI Act, GI Rules, registered GI list (filter Ayurvedic/herbal products) |
| CTRI (Clinical Trials Registry India) | https://ctri.nic.in | Registration guidelines, SOPs, FAQs |
| CDSCO (for NDCT Rules 2019) | https://cdsco.gov.in | New Drugs and Clinical Trials Rules 2019 full text |
| CSIR — TKDL overview | https://www.csir.res.in/en/documents/tkdl | TKDL background, scope, how it protects traditional knowledge |
| PIB TKDL factsheet | https://static.pib.gov.in/WriteReadData/specificdocs/documents/2022/sep/doc20229199001.pdf | Direct PDF — good clean starter document |
| WIPO — Traditional Knowledge | https://www.wipo.int/tk/en/ | Background briefs on TK and IP (useful for the international "future work" framing) |

**Note on TKDL:** The full TKDL database is behind a paid subscription — we cannot ingest it. Use the publicly available TKDL overview/policy documents instead (CSIR page and PIB factsheet above). Mention in the PPT that full TKDL integration is possible with institutional access — that's a strong roadmap point, not a gap.

### Target list — get 10 to 15 of these

1. AYUSH ministry circular(s) on IP / traditional knowledge protection
2. National IPR Policy 2016 (document text)
3. Manual of Patent Office Practice and Procedure (relevant chapters)
4. Patents Act — Section 3(p) and related traditional-knowledge exclusions
5. Geographical Indications of Goods Act & Rules
6. Registered GI list entries for Ayurvedic/herbal products
7. CTRI registration guidelines
8. NDCT Rules 2019 (relevant sections)
9. TKDL factsheet (PIB PDF above)
10. CSIR TKDL overview page (save as PDF)
11. Any AYUSH regulatory FAQ documents published by the ministry
12. Drugs and Cosmetics Act provisions relevant to Ayurvedic medicines

**This step needs no laptop.** It can be done entirely from a phone browser. Start it immediately.

---

# PART C — THE ORDER TO WORK IN

## Step 0 — Setup (do this first, everyone)

1. Create a private GitHub repo named `ip-sakti`
2. Add all teammates as collaborators
3. Create this folder structure:

```
ip-sakti/
├── PROJECT_GUIDE.md        ← this document
├── backend/
│   ├── ingestion/
│   │   ├── loader.py
│   │   ├── chunker.py
│   │   └── indexer.py
│   ├── retrieval/
│   │   ├── bm25_search.py
│   │   ├── dense_search.py
│   │   ├── fusion.py
│   │   └── reranker.py
│   ├── generation/
│   │   ├── prompts.py
│   │   ├── llm_client.py
│   │   └── citation.py
│   ├── graph/
│   │   ├── state.py
│   │   ├── nodes.py
│   │   └── build_graph.py
│   ├── api/
│   │   └── main.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
├── data/                   ← downloaded PDFs go here
└── docs/
```

4. Add a `.gitignore` — must include `.env`, `data/*.pdf`, `__pycache__/`, `node_modules/`
5. Set up a free Postgres with pgvector on Supabase or Neon, enable the `vector` extension
6. Install Ollama locally and pull a quantized model (Llama 3 or Mistral)
7. Get a free Groq API key for the fallback

## Step 1 — FIRST CODE TO WRITE: the ingestion pipeline

**Do this before anything else.** Everything downstream depends on it, and if the metadata is wrong here, citations break everywhere later.

Build in this order:

**1a. `loader.py`** — extract text from PDFs
- Use `pdfplumber` (handles tables better than PyMuPDF for regulatory documents)
- Return, per page: the text plus the page number and source filename
- Test: run it on one downloaded PDF, print the first page, confirm the text is readable and not garbled

**1b. `chunker.py`** — split text into chunks
- ~500 tokens per chunk, ~50 token overlap so sentences aren't cut mid-thought
- **Every chunk must carry:** `source_file`, `page_number`, `section_heading` (if detectable), `chunk_id`
- Test: chunk one document, print 3 chunks, confirm every one has all four metadata fields filled

**1c. `indexer.py`** — index the chunks twice
- Build a BM25 index over chunk texts (use `rank_bm25`), persist it to disk
- Generate embeddings with `sentence-transformers`, store chunk text + embedding + metadata in pgvector
- Test: query the database directly. **If `source_file` is empty on any row, stop and fix it before moving on.**

**Verification gate before Step 2:** Run a raw similarity search on the database with a test question. You should get back chunks that are topically relevant, each with a readable source filename. If not, the problem is here, not in the LLM.

## Step 2 — Hybrid retrieval

- `bm25_search.py` — query → top 20 chunks by keyword overlap
- `dense_search.py` — embed query → top 20 chunks by cosine similarity from pgvector
- `fusion.py` — Reciprocal Rank Fusion: score each chunk by summing `1 / (k + rank)` across the lists it appears in, with k = 60. Chunks ranking well in both rise to the top. Return fused top 20.

**Test both paths separately:** a query with an exact rule/section number should be found by BM25; a vague conceptual query should be found by dense. Then confirm fusion handles both.

## Step 3 — Reranking

- `reranker.py` — load a cross-encoder (`ms-marco-MiniLM` class), score each (query, chunk) pair, keep top 5
- Cross-encoders read query and chunk together, which is more accurate than comparing separate embeddings

**Test:** compare top-5 before and after reranking on a few queries. The improvement should be visible — this before/after is also good demo material.

## Step 4 — Grounded generation

- `prompts.py` — the system prompt must enforce:
  - Answer using ONLY the provided context chunks
  - Do not use outside knowledge, even when confident
  - If the context doesn't contain the answer, say so and ask one clarifying question
  - Do not write citations — the system handles attribution
- `llm_client.py` — Ollama primary, Groq fallback on timeout/unavailability, identical prompt for both

**Test:** ask something you know is NOT in the documents. The system must abstain. Run this test before every demo.

## Step 5 — Citations

- `citation.py` — take metadata from the chunks that were actually retrieved, attach as the source list. The LLM had no input into this.
- Optional verifier: split the answer into sentences, check each against the retrieved chunks for similarity, flag low-similarity sentences as unsupported

## Step 6 — LangGraph wiring

- `state.py` — state object holding: `query`, `rewritten_query`, `candidates`, `reranked`, `answer`, `citations`, `flags`
- `nodes.py` — one function per stage; each takes state, returns updated state
- `build_graph.py` — wire nodes in sequence with `add_edge`, compile

**Optional conditional branch if time allows:** after reranking, if the top score is below a threshold, route to a query-rewrite node and retry retrieval **once**. Genuine agentic behaviour, bounded — no infinite loop risk.

## Step 7 — API layer

`api/main.py`:
- `POST /query` — question (+ optional history) → answer + citations + flags
- `GET /health` — for hosting platform health checks
- `POST /ingest` — optional admin endpoint
- Handle CORS, request timeouts, and a clear error if the LLM is unreachable

## Step 8 — Frontend (can run in parallel from Step 1 onward, against mock responses)

- Chat interface: input box, conversation history
- Each answer shows a **Sources** section: document name, page/section, and the retrieved snippet in an expandable view
- Visible indicator when the system abstains
- Loading state during retrieval

**The citation display is the product's differentiator — make it prominent, not a footnote.**

## Step 9 — Multilingual (bolt on last, skippable)

- Detect query language → if Hindi, translate to English → run graph → translate answer back
- Keep source document names untranslated (official titles)
- Use Bhashini API (Government of India) or Google Translate free tier
- **If time is tight, ship English-only** and present Hindi as in-progress. Do not let this block Steps 1–7.

## Step 10 — Deployment

1. Backend → Render or Railway, connected to the GitHub repo
2. Frontend → Vercel, same repo
3. Database → Supabase/Neon with pgvector enabled
4. Set env vars (DB URL, Groq key) in each platform's dashboard — never commit keys
5. Run the ingestion script once against the production database
6. Test the deployed URLs end to end, not just localhost

**Important:** free-tier hosts likely can't run a local LLM. The deployed version uses Groq; keep the local Ollama setup for the offline demo path.

## Step 11 — Demo prep

1. Prepare 5–6 questions you've verified answer well
2. Prepare one deliberately out-of-scope question to demo the abstention — showing this on purpose signals engineering maturity
3. Test the fully offline path (local Ollama, no internet). Assume venue WiFi fails.
4. Record a backup demo video
5. PPT flow: problem → why existing approaches fail (the 17–33% hallucination finding) → our architecture → live demo → impact → future work (international regimes, TKDL integration with institutional access, more documents)

---

# PART D — WHO DOES WHAT

| Role | Steps |
|---|---|
| Backend/RAG Lead | 1, 2, 3, 4, 5, 6 |
| Frontend Lead | 8 |
| Data Collection Lead | Part B |
| Integration/Multilingual Lead | 7, 9, 10 |
| Presentation Lead | 11 |

**Runs in parallel from day one:** Part B (data collection), Step 8 (frontend against mocks), Step 11 (PPT drafting from this document).

**Strictly sequential:** Step 1 → 2 → 3 → 4 → 5 → 6 → 7 → 10.

---

# PART E — TALKING POINTS FOR JUDGES

1. **We don't use dense-only retrieval** — hybrid BM25 + dense with RRF fusion, because exact legal terms and section numbers matter in this domain.
2. **Our citations cannot be hallucinated** — the model never generates them; they come from our retrieval records.
3. **The system abstains** rather than guessing when the answer isn't in the sources.
4. **It runs fully offline** — local model primary, cloud API as enhancement, not dependency.
5. **Deterministic, traceable graph architecture** — we can show exactly what happened at every step of any query.
6. **We know the failure mode we're solving** — commercial legal AI tools hallucinate 17–33% of the time; our architecture is built specifically to prevent that.

---

# PART F — DO THIS RIGHT NOW

1. Create the GitHub repo with the Step 0 structure, add everyone
2. Assign roles from Part D
3. **Data Collection Lead: start Part B immediately** — phone browser is enough
4. **Whoever has a laptop: set up Postgres + pgvector, then start Step 1a**
5. Frontend Lead: start Step 8 against mock responses
6. Daily check-in on who is blocked
