"""
Dense (embedding) retrieval for IP-SAKTI.

Embeds the query with the same model used at ingestion time (EMBED_MODEL)
and finds the closest chunks in pgvector by cosine similarity. Embeddings are
normalized at both index and query time, so `1 - cosine_distance` is directly
comparable to the BM25 scores' ranking (not their scale — RRF only uses rank).

Usage:
    python -m retrieval.dense_search "what protects Ayurvedic formulations"
"""

from __future__ import annotations

import logging
import os
import sys

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

from ingestion.indexer import connect

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Load and cache the embedding model — reused across calls, not reloaded per query."""
    global _model
    if _model is None:
        log.info("Loading embedding model %s", EMBED_MODEL)
        _model = SentenceTransformer(EMBED_MODEL)
    return _model


def search(query: str, top_k: int = 20) -> list[dict]:
    """Query -> top_k chunks ranked by cosine similarity, with full metadata attached."""
    model = _get_model()
    embedding = model.encode(query, normalize_embeddings=True)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_id, source_file, page_number, section_heading, text,
                       1 - (embedding <=> %s) AS score
                FROM chunks
                ORDER BY embedding <=> %s
                LIMIT %s;
                """,
                (embedding, embedding, top_k),
            )
            rows = cur.fetchall()

    return [
        {
            "chunk_id": row[0],
            "source_file": row[1],
            "page_number": row[2],
            "section_heading": row[3],
            "text": row[4],
            "score": float(row[5]),
            "rank": rank,
        }
        for rank, row in enumerate(rows, start=1)
    ]


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "protection for Ayurvedic formulations"
    results = search(query, top_k=10)
    print(f"\nDense results for: {query!r}\n")
    if not results:
        print("  (no results)")
    for r in results:
        print(
            f"  #{r['rank']:>2}  {r['score']:.3f}  {r['chunk_id']}  "
            f"({r['source_file']} p{r['page_number']})"
        )
