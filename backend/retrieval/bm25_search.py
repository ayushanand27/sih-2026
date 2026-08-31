"""
BM25 sparse retrieval for IP-SAKTI.

Loads the BM25 index built by ingestion.indexer and searches it with the
identical tokenizer used at index time — imported, not redefined, because if
the two ever diverge, BM25 silently stops matching with no error to tell you.

Usage:
    python -m retrieval.bm25_search "Section 3(p) traditional knowledge"
"""

from __future__ import annotations

import logging
import os
import pickle
import sys
from pathlib import Path

from dotenv import load_dotenv

from ingestion.indexer import tokenize

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

BM25_PATH = Path(os.getenv("BM25_INDEX_PATH", "backend/indexes/bm25.pkl"))

_bm25 = None
_chunk_ids: list[str] | None = None


def _load_index():
    """Load and cache the BM25 pickle. Fails loudly if it isn't there yet."""
    global _bm25, _chunk_ids
    if _bm25 is not None:
        return _bm25, _chunk_ids

    if not BM25_PATH.exists():
        raise FileNotFoundError(
            f"BM25 index not found at {BM25_PATH}. "
            "Run `python -m ingestion.indexer` first to build it."
        )

    with open(BM25_PATH, "rb") as handle:
        payload = pickle.load(handle)

    _bm25 = payload["bm25"]
    _chunk_ids = payload["chunk_ids"]
    log.info("Loaded BM25 index: %d chunks", len(_chunk_ids))
    return _bm25, _chunk_ids


def search(query: str, top_k: int = 20) -> list[dict]:
    """Query -> top_k chunk_ids ranked by BM25 score, highest first.

    Score positions map back to chunk_ids by index, since the pickle stores
    chunk_ids in the same order as the corpus BM25Okapi was built from.
    """
    bm25, chunk_ids = _load_index()

    tokens = tokenize(query)
    if not tokens:
        log.warning("Query tokenized to nothing: %r", query)
        return []

    scores = bm25.get_scores(tokens)

    ranked = sorted(
        ((chunk_ids[i], score) for i, score in enumerate(scores) if score > 0),
        key=lambda pair: pair[1],
        reverse=True,
    )[:top_k]

    return [
        {"chunk_id": chunk_id, "score": float(score), "rank": rank}
        for rank, (chunk_id, score) in enumerate(ranked, start=1)
    ]


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "traditional knowledge patent exclusion"
    results = search(query, top_k=10)
    print(f"\nBM25 results for: {query!r}\n")
    if not results:
        print("  (no results)")
    for r in results:
        print(f"  #{r['rank']:>2}  {r['score']:.3f}  {r['chunk_id']}")
