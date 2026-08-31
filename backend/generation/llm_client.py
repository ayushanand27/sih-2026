"""
LLM client for IP-SAKTI generation.

Groq only for now. Ollama is deliberately out of scope until its local
latency is verified — wiring in a fallback before the primary path is proven
would let a slow or broken local path pass unnoticed.

Usage:
    python -m generation.llm_client "What does Section 3(p) say?"
"""

from __future__ import annotations

import logging
import os
import sys

from dotenv import load_dotenv
from groq import Groq

from generation.prompts import SYSTEM_PROMPT, build_user_prompt

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

_client: Groq | None = None


def _get_client() -> Groq:
    """Create and cache the Groq client. Fails loudly if the key is missing."""
    global _client
    if _client is None:
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Copy .env.example to .env and fill it in."
            )
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


def complete(user_prompt: str, system_prompt: str | None = None) -> str:
    """Raw Groq chat completion. Used by generate() below, and by the
    graph's query-rewrite nodes, which need a plain LLM call with no
    retrieval involved."""
    client = _get_client()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.0,
        )
    except Exception as exc:
        raise RuntimeError(
            f"Groq request failed ({GROQ_MODEL}): {exc}. "
            "Check GROQ_API_KEY and network connectivity."
        ) from exc

    return response.choices[0].message.content.strip()


def generate(query: str, chunks: list[dict]) -> str:
    """Call Groq with the grounded prompt and return the raw answer text."""
    return complete(build_user_prompt(query, chunks), system_prompt=SYSTEM_PROMPT)


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "What does Section 3(p) say about traditional knowledge?"
    answer = generate(query, chunks=[])
    print(f"\nQuery: {query!r}\n")
    print(answer)
