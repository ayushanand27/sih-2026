"""
Reciprocal Rank Fusion for IP-SAKTI.

Merges the BM25 and dense ranked lists into one, so a chunk that ranks well
in either (or both) rises to the top. Legal text needs both exact-term
matching and semantic matching, so neither list is trusted alone.

score(chunk) = sum of 1 / (k + rank) across every list the chunk appears in,
with k = 60 and rank 1-indexed within each list.

Usage:
    python -m retrieval.fusion "Section 3(p) traditional knowledge"
"""

from __future__ import annotations

import logging
import sys

from dotenv import load_dotenv

from ingestion.indexer import connect
from retrieval.bm25_search import search as bm25_search
from retrieval.dense_search import search as dense_search

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

RRF_K = 60


def _fetch_metadata(chunk_ids: list[str]) -> dict[str, dict]:
    """Back-fill metadata for chunk_ids BM25 surfaced that dense did not — the
    BM25 index only stores ids and scores, so those chunks need a DB lookup
    before they can carry a citation."""
    if not chunk_ids:
        return {}

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_id, source_file, page_number, section_heading, text
                FROM chunks
                WHERE chunk_id = ANY(%s);
                """,
                (chunk_ids,),
            )
            rows = cur.fetchall()

    return {
        row[0]: {
            "source_file": row[1],
            "page_number": row[2],
            "section_heading": row[3],
            "text": row[4],
        }
        for row in rows
    }


def fuse(
    bm25_results: list[dict],
    dense_results: list[dict],
    top_k: int = 20,
    k: int = RRF_K,
) -> list[dict]:
    """Combine two ranked lists into one fused ranking with metadata intact."""
    scores: dict[str, float] = {}
    metadata: dict[str, dict] = {}

    for result in bm25_results:
        cid = result["chunk_id"]
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + result["rank"])

    for result in dense_results:
        cid = result["chunk_id"]
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + result["rank"])
        metadata[cid] = {
            "source_file": result["source_file"],
            "page_number": result["page_number"],
            "section_heading": result["section_heading"],
            "text": result["text"],
        }

    missing = [cid for cid in scores if cid not in metadata]
    if missing:
        metadata.update(_fetch_metadata(missing))

    ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)[:top_k]

    fused = []
    for rank, (chunk_id, score) in enumerate(ranked, start=1):
        meta = metadata.get(chunk_id)
        if meta is None:
            log.warning("No metadata found for %s in the database — dropping it "
                        "rather than returning an uncitable chunk", chunk_id)
            continue
        fused.append({"chunk_id": chunk_id, "score": score, "rank": rank, **meta})

    return fused


def search(query: str, top_k: int = 20) -> list[dict]:
    """Run both retrievers and fuse their results for a single query."""
    bm25_results = bm25_search(query, top_k=top_k)
    dense_results = dense_search(query, top_k=top_k)
    return fuse(bm25_results, dense_results, top_k=top_k)


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "traditional knowledge patent exclusion"
    results = search(query, top_k=10)
    print(f"\nFused results for: {query!r}\n")
    if not results:
        print("  (no results)")
    for r in results:
        print(
            f"  #{r['rank']:>2}  {r['score']:.4f}  {r['chunk_id']}  "
            f"({r['source_file']} p{r['page_number']})"
        )
