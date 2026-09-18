"""Inspect pgvector HNSW index definition and session GUCs (no secrets printed)."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(override=True)

from ingestion.indexer import connect_async


async def main() -> None:
    conn = await connect_async()
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'chunks' AND indexname LIKE '%embedding%';
                """
            )
            indexes = await cur.fetchall()

            await cur.execute(
                """
                SELECT c.relname, c.reloptions
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'chunks_embedding_idx';
                """
            )
            relopts = await cur.fetchall()

            gucs = [
                "hnsw.ef_search",
                "ivfflat.probes",
                "enable_seqscan",
                "random_page_cost",
            ]
            settings = {}
            for guc in gucs:
                await cur.execute("SELECT current_setting(%s, true);", (guc,))
                row = await cur.fetchone()
                settings[guc] = row[0] if row else None

            await cur.execute("SHOW server_version;")
            pg_version = (await cur.fetchone())[0]

            await cur.execute(
                """
                EXPLAIN (FORMAT JSON)
                SELECT chunk_id FROM chunks
                WHERE jurisdiction = 'india'
                ORDER BY embedding <=> (
                    SELECT embedding FROM chunks WHERE jurisdiction = 'india' LIMIT 1
                )
                LIMIT 15;
                """
            )
            explain = await cur.fetchone()
    finally:
        await conn.close()

    out = {
        "pg_indexes": [{"name": r[0], "def": r[1]} for r in indexes],
        "chunks_embedding_idx_reloptions": relopts,
        "session_gucs": settings,
        "server_version": pg_version,
        "dense_query_plan": explain[0] if explain else None,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
