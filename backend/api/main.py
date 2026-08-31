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

app = FastAPI(title="IP-SAKTI Sahayak API")

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
    role: str
    content: str


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)


class Citation(BaseModel):
    chunk_id: str
    source_file: str
    page_number: int
    section_heading: str


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    flags: dict


class IngestRequest(BaseModel):
    reset: bool = False


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    app_graph = _get_graph()
    history = [turn.model_dump() for turn in req.history]

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(
                app_graph.invoke,
                {"query": req.question, "history": history, "flags": {}},
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


@app.post("/ingest")
async def ingest(req: IngestRequest, x_admin_token: str | None = Header(default=None)):
    if ADMIN_TOKEN and x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing admin token.")

    try:
        await run_in_threadpool(run_ingestion, req.reset)
    except Exception as exc:
        log.exception("Ingestion failed")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")

    return {"status": "ok"}
