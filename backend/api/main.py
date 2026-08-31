"""
FastAPI layer for IP-SAKTI.

A thin HTTP wrapper over the LangGraph pipeline. The graph itself is
synchronous (it calls blocking retrieval/generation code), so /query runs it
in a thread pool under a hard wall-clock timeout, instead of blocking the
event loop or hanging forever if an LLM backend stalls.

Usage:
    python -m uvicorn api.main:app --reload
"""

from __future__ import annotations

import asyncio
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from graph.build_graph import build_graph
from graph.state import DEFAULT_FLAGS
from ingestion.indexer import run as run_ingestion

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "60"))
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")]
# If unset, /ingest is unauthenticated — fine for local dev, not for a public
# deployment. Set ADMIN_TOKEN before deploying anywhere reachable from the
# internet.
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")

app = FastAPI(
    title="IP-SAKTI Sahayak API",
    description=(
        "Source-cited AI assistant for Ayurveda-related IP and regulatory "
        "questions (SIH26045, Ministry of Ayush). Answers only from the "
        "indexed document corpus, with programmatic citations attached from "
        "retrieved chunks — never from the model. See docs/API_CONTRACT.md "
        "in the repo for full integration details, real example responses, "
        "and timing expectations."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph = None


def _get_graph():
    """Build and cache the compiled graph once, reused across requests."""
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


class ChatTurn(BaseModel):
    role: str = Field(description='"user" or "assistant".')
    content: str


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, description="The user's question.")
    history: list[ChatTurn] = Field(
        default_factory=list,
        description=(
            "Prior turns, oldest first, NOT including the current question "
            "(that goes in `question`). Omit or pass [] for a single-turn query."
        ),
    )


class Citation(BaseModel):
    chunk_id: str = Field(description="Internal id, not meant for display.")
    source_file: str = Field(description="The source PDF's filename — display this as the citation.")
    page_number: int = Field(description="1-indexed page number within source_file.")
    section_heading: str = Field(
        description=(
            "Best-effort detected heading. Heuristic, not guaranteed accurate — "
            "falls back to the literal string 'Unlabelled section' if nothing "
            "heading-shaped was found nearby."
        )
    )


class Flags(BaseModel):
    abstained: bool = Field(
        default=False,
        description=(
            "The authoritative way to detect an abstention. True means the "
            "retrieved context did not contain the answer, and `answer` is a "
            "refusal + clarifying question rather than a real answer. Do not "
            "detect this by string-matching `answer` instead."
        ),
    )
    retried: bool = Field(
        default=False,
        description="True if the bounded retry-once path fired (weak initial rerank score). Informational only.",
    )


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation] = Field(
        description="Always [] when flags.abstained is true — nothing was actually used to answer."
    )
    flags: Flags


class IngestRequest(BaseModel):
    reset: bool = Field(
        default=False,
        description="True drops and rebuilds the chunks table + BM25 index from scratch. False upserts.",
    )


class HealthResponse(BaseModel):
    status: str


class IngestResponse(BaseModel):
    status: str


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="For hosting-platform health checks. No dependency checks (DB, LLM) — just confirms the process is up.",
)
def health():
    return HealthResponse(status="ok")


@app.post(
    "/query",
    response_model=QueryResponse,
    summary="Answer a question from the indexed documents",
    description=(
        "Runs the full pipeline: query rewrite -> hybrid retrieval -> "
        "cross-encoder reranking -> grounded generation -> citation "
        "attachment. Answers only from retrieved context; abstains "
        "(flags.abstained=true) if the context doesn't contain the answer. "
        "See docs/API_CONTRACT.md for real example responses and timing."
    ),
    responses={
        503: {"description": "Neither Ollama nor Groq could be reached."},
        504: {"description": "Request exceeded REQUEST_TIMEOUT with no LLM response."},
        500: {"description": "Unhandled internal error."},
    },
)
async def query(req: QueryRequest):
    app_graph = _get_graph()
    history = [turn.model_dump() for turn in req.history]

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(
                app_graph.invoke,
                {"query": req.question, "history": history, "flags": dict(DEFAULT_FLAGS)},
            ),
            timeout=REQUEST_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Request exceeded {REQUEST_TIMEOUT}s with no response from any LLM backend.",
        )
    except RuntimeError as exc:
        # Raised by generation.llm_client when neither Ollama nor Groq is reachable.
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        log.exception("Unhandled error in /query")
        raise HTTPException(status_code=500, detail="Internal error processing the query.")

    return QueryResponse(
        answer=result["answer"],
        citations=result.get("citations") or [],
        flags=result.get("flags") or {},
    )


@app.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Re-run ingestion (admin/dev)",
    description=(
        "Re-indexes every PDF in DATA_DIR: chunks, embeds into pgvector, "
        "rebuilds the BM25 index. Not a frontend-facing endpoint. Takes "
        "1-2 minutes on the current corpus size. Requires header "
        "X-Admin-Token if ADMIN_TOKEN is set in the backend's .env; open "
        "if unset (local-dev default)."
    ),
    responses={
        401: {"description": "Missing or invalid X-Admin-Token (only when ADMIN_TOKEN is set)."},
        500: {"description": "Ingestion failed (e.g. bad PDF, DB unreachable)."},
    },
)
async def ingest(req: IngestRequest, x_admin_token: str | None = Header(default=None)):
    if ADMIN_TOKEN and x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing admin token.")

    try:
        await run_in_threadpool(run_ingestion, req.reset)
    except Exception as exc:
        log.exception("Ingestion failed")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")

    return IngestResponse(status="ok")
