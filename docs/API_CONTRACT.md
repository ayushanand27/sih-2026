# IP-SAKTI Sahayak — Backend API Contract

For whoever is building the frontend. Every example response in this document
was copied verbatim from real `curl` output against a running server on this
machine — none of it is hand-written. If the backend changes in a way that
breaks these examples, that's a bug in this doc, please flag it.

## Running the backend locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; `source .venv/bin/activate` on Mac/Linux
pip install -r requirements.txt
cp env.example.txt .env         # then fill in DATABASE_URL and GROQ_API_KEY
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

The corpus must already be indexed (`python -m ingestion.indexer --reset`) —
if the `chunks` table is empty, `/query` will still respond, but retrieval
will return nothing and the system will abstain on everything.

## Base URL

Local dev: `http://127.0.0.1:8000`

No `/api` or `/v1` prefix — endpoints are mounted directly at the paths
below. There is no production URL yet (not deployed).

## CORS

Controlled by `CORS_ORIGINS` in `backend/.env`, comma-separated. Currently set
to `*` (all origins allowed) for local dev — nothing to configure on the
frontend side right now. Before deploying, this should be narrowed to the
actual frontend origin(s); if that happens, this doc will be updated with the
real value.

---

## Endpoints

### `GET /health`

No parameters. Used for hosting-platform health checks.

**Response `200`:**
```json
{"status": "ok"}
```

---

### `POST /query`

**Request body:**
```json
{
  "question": "string, required, min length 1",
  "history": [
    {"role": "user", "content": "string"},
    {"role": "assistant", "content": "string"}
  ]
}
```
`history` is optional — omit it entirely for a single-turn question, or pass
`[]`. When present, it's used to rewrite `question` into a standalone query
before retrieval (e.g. resolving "what about that section?" against the prior
turn). Order matters: oldest turn first, most recent last. The current
question is NOT included in `history` — send it only in `question`.

**Response `200`** (`QueryResponse`):
```json
{
  "answer": "string",
  "citations": [ /* array of Citation objects, see below — can be empty */ ],
  "flags": {
    "abstained": false,
    "retried": false
  }
}
```

**Error responses** — see "Error handling" below.

---

### `POST /ingest`

Admin/dev endpoint — re-runs the ingestion pipeline (loads PDFs from `data/`,
re-embeds, rebuilds the BM25 index). Not something the frontend should ever
call in normal operation; documented here for completeness.

**Request body:**
```json
{"reset": false}
```
`reset: true` drops and rebuilds the `chunks` table and BM25 index from
scratch; `false` (default) upserts. This can take 1–2 minutes for the current
corpus size (real measured time: ~59s to re-embed 1019 chunks).

**Auth:** if `ADMIN_TOKEN` is set in the backend's `.env`, this endpoint
requires header `X-Admin-Token: <token>` or returns `401`. If `ADMIN_TOKEN`
is unset (the current local-dev default), the endpoint is open.

**Response `200`:**
```json
{"status": "ok"}
```

---

## The Citation object

```json
{
  "chunk_id": "Manual_of_Patent_Office_Practice_and_Procedure::p99::c99",
  "source_file": "Manual_of_Patent_Office_Practice_and_Procedure.pdf",
  "page_number": 99,
  "section_heading": "08.03.05.15 An invention which in effect, is traditional knowledge or Section 3(p)"
}
```

| Field | Type | Meaning | Can it be empty? |
|---|---|---|---|
| `chunk_id` | string | Internal id (`{source_file_stem}::p{page}::c{n}`). Not meant for display — useful for debugging/logs, or as a React `key`. | No, always present. |
| `source_file` | string | The PDF's filename, exactly as it sits in `data/`. **This is what the user should see as "the source"** — display it directly, don't reformat it (filenames were deliberately cleaned up to be citation-ready, e.g. `New_Drugs_and_Clinical_Trials_Rules_2019.pdf`, not `doc1.pdf`). | No — the ingestion pipeline hard-fails if any chunk is missing this. |
| `page_number` | integer | 1-indexed PDF page number. | No. |
| `section_heading` | string | Best-effort detected section/clause heading for that part of the document (e.g. `"CHAPTER III"`, `"08.03.05.15 An invention..."`). Heuristic, not perfect — falls back to `"Unlabelled section"` if nothing heading-shaped was found nearby. **Treat this as a helpful hint, not a guaranteed-accurate label** — it's derived from regex pattern-matching on PDF text layout, and can occasionally show a heading from a neighboring clause rather than the exact one. | Never actually empty (falls back to the literal string `"Unlabelled section"`), but can be low-quality. Don't build UI that breaks if it's not a "real" heading-looking string. |

`citations` is an array of these, already deduplicated by `chunk_id`, in the
order the reranker ranked them (most relevant first — index 0 is the
strongest source). **`citations` is `[]` on abstention** — see next section.

---

## Detecting abstention — use `flags.abstained`, not string-matching

**Use `response.flags.abstained` (boolean). Do not parse `answer` text.**

This was originally only detectable by checking whether `answer` started with
a fixed sentence, which would have forced the frontend to string-match
against backend copy — fragile, and it would silently break if that sentence
ever gets reworded. Before you built against it, we added a proper field:
`flags.abstained` is a real boolean, always present in every `/query`
response (not just abstentions — it's `false` on a normal answer).

```json
"flags": {
  "abstained": true,   // <-- check this
  "retried": true       // true if the backend internally retried retrieval
                         //     once with a reworded query before giving up.
                         //     Informational only — doesn't need frontend
                         //     handling, but useful if you want to show
                         //     e.g. a subtly different loading state.
}
```

Secondary signal, if you want a belt-and-suspenders check: `citations` is
always `[]` when `flags.abstained` is `true`. Don't rely on this alone though
— an extremely obscure question could theoretically retrieve zero chunks
without the model technically "abstaining" in the guardrail sense. `flags.abstained`
is the one guaranteed-correct signal.

Both `abstained` and `retried` keys are **always present** in `flags` (never
missing, never `null`) — safe to read `response.flags.abstained` directly
without an existence check.

---

## Timing expectations — read this before building the loading state

**Current measured reality on this dev machine, real numbers, not estimates:**

| Scenario | Measured wall time |
|---|---|
| First request after server start (cold model load) | ~33s |
| Normal in-scope question, warm server | ~29s |
| Out-of-scope question (triggers one internal retry) | ~54s |
| Validation error (bad request body) | <10ms |
| Both LLM backends unreachable | ~16s before the error returns |

**Why so slow:** the backend tries a local Ollama model first (by design —
the whole point is working without internet at a live demo), and Ollama is
currently timing out on every single call (`OLLAMA_TIMEOUT=15s` in the
backend's `.env`) before falling back to Groq, because of a CUDA driver
incompatibility on this dev machine unrelated to this API. A question that
triggers the internal retry-once path pays that 15s timeout **twice** (once
for the query-rewrite call, once for the final answer) before Groq ever
responds — hence the ~54s worst case. This is a known, documented issue on
the backend side, not something to work around in the frontend.

**What this means for your loading state:**
- Do **not** build a UI that assumes a snappy sub-2-second response.
- Build a loading state that stays sensible up to **60 seconds** (the
  backend's own `REQUEST_TIMEOUT`), e.g. a progress indicator with elapsed
  time, or rotating status text — not just a spinner that looks broken after
  10 seconds.
- Set your own client-side fetch timeout to **65–70 seconds**, comfortably
  above the backend's 60s `REQUEST_TIMEOUT` — you want the backend's own
  clean `504` (see below) to fire first, not your fetch call timing out with
  a less informative error.
- If the CUDA issue on the backend gets fixed, these numbers should drop
  substantially (local GPU inference, not CPU) — this doc will be updated if
  so. Don't hardcode a "39 second minimum" assumption anywhere.

---

## Error handling

| Status | When | Body shape |
|---|---|---|
| `422` | Request body fails validation (e.g. missing `question`) | FastAPI's standard validation shape — see real example below |
| `503` | Neither Ollama nor Groq could be reached | `{"detail": "<human-readable message>"}` |
| `504` | The whole request exceeded the server's `REQUEST_TIMEOUT` (60s default) | `{"detail": "Request exceeded 60.0s with no response from any LLM backend."}` |
| `500` | Anything else unhandled | `{"detail": "Internal error processing the query."}` |

All error bodies have a top-level `detail` key — for `422` it's an array of
field-level problems (Pydantic's default shape), for everything else it's a
plain string. Safe pattern: `if (!res.ok) { const { detail } = await res.json(); ... }`.

---

## Real example responses

### 1. In-scope answer, with citations

Request:
```bash
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What does Section 3(p) say about traditional knowledge?"}'
```

Response — `200`, measured `time_total: 28.5s`:
```json
{
  "answer": "Section 3(p) provides that an invention which, in effect, is traditional knowledge—or merely an aggregation or duplication of the known properties of traditionally known component(s)—is not regarded as an invention and therefore is not patentable.",
  "citations": [
    {
      "chunk_id": "Manual_of_Patent_Office_Practice_and_Procedure::p99::c99",
      "source_file": "Manual_of_Patent_Office_Practice_and_Procedure.pdf",
      "page_number": 99,
      "section_heading": "08.03.05.15 An invention which in effect, is traditional knowledge or Section 3(p)"
    },
    {
      "chunk_id": "Documenting_Traditional_Knowledge_EACPM::p6::c7",
      "source_file": "Documenting_Traditional_Knowledge_EACPM.pdf",
      "page_number": 6,
      "section_heading": "5 Ibid"
    },
    {
      "chunk_id": "IPO_Guidelines_Traditional_Knowledge_and_Biological_Material::p2::c2",
      "source_file": "IPO_Guidelines_Traditional_Knowledge_and_Biological_Material.pdf",
      "page_number": 2,
      "section_heading": "KNOWLEDGE AND BIOLOGICAL MATERIAL"
    },
    {
      "chunk_id": "Documenting_Traditional_Knowledge_EACPM::p15::c22",
      "source_file": "Documenting_Traditional_Knowledge_EACPM.pdf",
      "page_number": 15,
      "section_heading": "Chapter 2"
    },
    {
      "chunk_id": "Documenting_Traditional_Knowledge_EACPM::p7::c10",
      "source_file": "Documenting_Traditional_Knowledge_EACPM.pdf",
      "page_number": 7,
      "section_heading": "10 Ibid"
    }
  ],
  "flags": {
    "abstained": false,
    "retried": false
  }
}
```
Note `section_heading` values like `"5 Ibid"` or `"10 Ibid"` — these are
genuine, if unhelpful, headings detected in a source document that uses
"Ibid" footnote-style references. This is the "heuristic, not perfect"
behavior mentioned in the Citation table above; don't be surprised by it.

### 2. Abstention

Request:
```bash
curl -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the capital of France?"}'
```

Response — `200` (abstention is not an HTTP error, it's a normal successful
response), measured `time_total: 54.4s`:
```json
{
  "answer": "I could not find this in my sources.  \nCould you specify which document or section you expect the information about the capital city of France to be found in?",
  "citations": [],
  "flags": {
    "abstained": true,
    "retried": true
  }
}
```
Check `flags.abstained === true` to render this differently from a normal
answer (e.g. a distinct visual style, no Sources section rendered instead of
an empty one). Do not pattern-match the `answer` string.

### 3. Error cases

**Bad request** (missing `question`):
```bash
curl -X POST http://127.0.0.1:8000/query -H "Content-Type: application/json" -d '{}'
```
Response — `422`, measured `time_total: 0.006s`:
```json
{"detail":[{"type":"missing","loc":["body","question"],"msg":"Field required","input":{}}]}
```

**No LLM backend reachable** (captured by deliberately pointing the backend
at an invalid Ollama host and an invalid Groq key):
```bash
curl -X POST http://127.0.0.1:8000/query -H "Content-Type: application/json" \
  -d '{"question": "What does Section 3(p) say?"}'
```
Response — `503`, measured `time_total: 16.4s`:
```json
{"detail":"No LLM backend reachable: Ollama failed and Groq failed (Error code: 401 - {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}). Check that Ollama is running (OLLAMA_HOST) or GROQ_API_KEY / network connectivity."}
```
The exact wording of the inner error will vary (it echoes whatever Groq/Ollama
reported), but the shape — `{"detail": "No LLM backend reachable: ..."}` — is
stable. Match on status code `503`, not on the message text.
