"""
Auth API tests — no Postgres or LLM required.

Usage:
    python -m pytest tests/test_auth.py -v
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def auth_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db = tmp_path / "test_auth.sqlite"
    monkeypatch.setenv("AUTH_DB_PATH", str(db))
    monkeypatch.setenv("AUTH_SECRET", "test-secret-key-for-pytest")
    monkeypatch.setenv("DEMO_LOGIN_PHONE", "9876543210")
    monkeypatch.setenv("DEMO_LOGIN_PASSWORD", "demo123")

    import api.auth_store as auth_store_module

    auth_store_module._store = None

    from api.main import app

    with TestClient(app) as client:
        yield client

    auth_store_module._store = None


def test_demo_login_succeeds(auth_client: TestClient):
    res = auth_client.post(
        "/auth/login",
        json={"identifier": "9876543210", "password": "demo123", "remember_me": True},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["name"]
    assert body["access_token"]

    me = auth_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == body["user"]["id"]


def test_login_rejects_wrong_password(auth_client: TestClient):
    res = auth_client.post(
        "/auth/login",
        json={"identifier": "9876543210", "password": "wrong", "remember_me": True},
    )
    assert res.status_code == 401


def test_register_and_login(auth_client: TestClient):
    reg = auth_client.post(
        "/auth/register",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "mobile": "9123456789",
            "password": "secret1",
        },
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    login = auth_client.post(
        "/auth/login",
        json={"identifier": "test@example.com", "password": "secret1", "remember_me": True},
    )
    assert login.status_code == 200
    assert login.json()["access_token"] != token or login.json()["access_token"]


def test_forgot_password_message(auth_client: TestClient):
    res = auth_client.post("/auth/forgot-password")
    assert res.status_code == 200
    assert "facilitator" in res.json()["message"].lower()
