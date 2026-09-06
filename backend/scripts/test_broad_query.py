#!/usr/bin/env python
"""Direct script test for broad patent query latency."""

from __future__ import annotations

import asyncio
import sys
import time

from graph.build_graph import build_graph
from graph.state import DEFAULT_FLAGS

BROAD_QUERY = "I WANT TO PATENT A MEDICINE FORMULA"
MAX_SECONDS = 15.0


async def main() -> int:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    graph = build_graph()
    t0 = time.monotonic()
    try:
        result = await asyncio.wait_for(
            graph.ainvoke(
                {
                    "query": BROAD_QUERY,
                    "history": [],
                    "jurisdiction": "india",
                    "flags": dict(DEFAULT_FLAGS),
                }
            ),
            timeout=MAX_SECONDS,
        )
    except asyncio.TimeoutError:
        print(f"FAIL: query exceeded {MAX_SECONDS}s", file=sys.stderr)
        return 1

    elapsed = time.monotonic() - t0
    answer = result.get("answer", "")
    print(f"Query: {BROAD_QUERY!r}")
    print(f"Elapsed: {elapsed:.2f}s")
    print(f"Answer preview: {answer[:300]}...")
    if elapsed >= MAX_SECONDS or not answer:
        print("FAIL: no valid response within budget", file=sys.stderr)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(asyncio.run(main()))
