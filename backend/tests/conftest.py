"""Pytest hooks shared across the backend test suite."""

from __future__ import annotations

import asyncio
import sys


def pytest_configure(config):  # noqa: ARG001
    # Same fix as run.py — psycopg async mode breaks under Windows Proactor.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
