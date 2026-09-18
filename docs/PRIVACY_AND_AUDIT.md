# Privacy and audit logging (hackathon scope)

IP-SAKTI Sahayak is a demonstration assistant, not a production compliance
system. This document describes what the backend logs today and what we intend
for a post-hackathon deployment.

## What is logged (default)

On every `POST /query` and `POST /query/stream` request, the API emits one
structured **audit** line at `INFO` level:

| Field | Meaning |
|---|---|
| `request_id` | Random UUID per request (correlates warm-up / error logs if needed) |
| `endpoint` | `/query` or `/query/stream` |
| `ts` | UTC ISO-8601 timestamp |
| `query_len` | Character length of the question (not the text itself) |
| `language` | `QueryRequest.language` BCP-47 code |
| `jurisdiction` | `india` or `international` |

Answers, citations, retrieved chunk text, and API keys are **not** logged by
default.

## Optional full query logging

Set `LOG_QUERY_CONTENT=true` in the backend environment to also log the full
`question` string in the audit line. Use only for controlled debugging
(local dev or a locked-down staging host). Do not enable on a shared demo
deployment without explicit operator consent and a retention policy.

## What is not logged

- Full model answers or abstention rationales
- User identity (optional JWT login for the demo UI — not linked to query audit logs yet)
- Client IP or session IDs (could be added at the reverse proxy later)
- Translation or TTS payloads sent to Bhashini / Sarvam

Third-party providers (Groq, Bhashini, Sarvam, Postgres host) have their own
privacy terms; this app forwards question/answer text to those services when
configured.

## Retention intention

Today, logs go to the process stdout of whatever runs `python run.py` (local
terminal, Render/Railway log drain). **No automated retention or deletion**
is implemented in-repo. For a real pilot we would:

1. Ship audit events to a tamper-evident store with a defined retention window.
2. Separate security logs from content logs.
3. Document lawful basis and user notice under India's DPDP Act (2023).

## Post-hackathon roadmap (honest)

- User-facing notice that queries may be logged (see UI disclaimer).
- Data-processing agreement templates for ministry / incubator hosts.
- Redaction pipeline before any log export for evaluator review.
- Optional on-prem mode with no external LLM (already partially sketched via
  `OFFLINE_MODE` for Groq).
