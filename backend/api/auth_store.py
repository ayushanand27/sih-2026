"""
Demo user accounts for the SIH prototype (SQLite).

Not production auth — passwords are salted PBKDF2 hashes and accounts are
stored locally for facilitator demos. A built-in demo user is seeded from
DEMO_LOGIN_PHONE / DEMO_LOGIN_PASSWORD on first open.
"""

from __future__ import annotations

import hashlib
import os
import re
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path

PBKDF2_ITERATIONS = 260_000


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def normalize_phone_digits(value: str) -> str:
    """Digits only — strips country codes and formatting."""
    return re.sub(r"\D", "", value.strip())


def normalize_login_identifier(identifier: str) -> tuple[str, str]:
    """
    Returns (kind, normalized) where kind is 'email' or 'phone'.
    Phone values are digit-only (no country prefix).
    """
    raw = identifier.strip()
    if "@" in raw:
        return "email", _normalize_email(raw)
    return "phone", normalize_phone_digits(raw)


@dataclass(frozen=True)
class StoredUser:
    id: str
    name: str
    email: str | None
    mobile_digits: str | None
    password_hash: str


class AuthStore:
    def __init__(self, db_path: Path) -> None:
        self._path = db_path
        self._lock = threading.Lock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()
        self._seed_demo_user()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    mobile_digits TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )
            conn.commit()

    @staticmethod
    def hash_password(password: str, salt: bytes | None = None) -> str:
        if salt is None:
            salt = os.urandom(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
        )
        return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"

    @staticmethod
    def verify_password(password: str, stored: str) -> bool:
        try:
            algo, iterations_str, salt_hex, digest_hex = stored.split("$", 3)
            if algo != "pbkdf2_sha256":
                return False
            iterations = int(iterations_str)
            salt = bytes.fromhex(salt_hex)
            expected = bytes.fromhex(digest_hex)
        except (ValueError, TypeError):
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, iterations
        )
        return actual == expected

    def _seed_demo_user(self) -> None:
        demo_phone = normalize_phone_digits(
            os.getenv("DEMO_LOGIN_PHONE", "9876543210")
        )
        demo_password = os.getenv("DEMO_LOGIN_PASSWORD", "demo123")
        demo_name = os.getenv("DEMO_LOGIN_NAME", "Demo User")
        demo_email = os.getenv("DEMO_LOGIN_EMAIL", "demo@ipsakti.local")

        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT id FROM users WHERE mobile_digits = ? OR email = ?",
                (demo_phone, _normalize_email(demo_email)),
            ).fetchone()
            if row:
                return
            conn.execute(
                """
                INSERT INTO users (id, name, email, mobile_digits, password_hash)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    demo_name,
                    _normalize_email(demo_email),
                    demo_phone,
                    self.hash_password(demo_password),
                ),
            )
            conn.commit()

    def register(
        self,
        *,
        name: str,
        email: str,
        mobile: str,
        password: str,
    ) -> StoredUser:
        email_norm = _normalize_email(email)
        mobile_digits = normalize_phone_digits(mobile)
        if len(mobile_digits) < 7:
            raise ValueError("Mobile number is too short.")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters.")
        user_id = str(uuid.uuid4())
        password_hash = self.hash_password(password)
        with self._lock, self._connect() as conn:
            try:
                conn.execute(
                    """
                    INSERT INTO users (id, name, email, mobile_digits, password_hash)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (user_id, name.strip(), email_norm, mobile_digits, password_hash),
                )
                conn.commit()
            except sqlite3.IntegrityError as exc:
                raise ValueError("An account with that email or mobile already exists.") from exc
        return StoredUser(
            id=user_id,
            name=name.strip(),
            email=email_norm,
            mobile_digits=mobile_digits,
            password_hash=password_hash,
        )

    def authenticate(self, identifier: str, password: str) -> StoredUser | None:
        kind, normalized = normalize_login_identifier(identifier)
        with self._lock, self._connect() as conn:
            if kind == "email":
                row = conn.execute(
                    "SELECT * FROM users WHERE email = ?", (normalized,)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM users WHERE mobile_digits = ?", (normalized,)
                ).fetchone()
            if row is None:
                return None
            user = StoredUser(
                id=row["id"],
                name=row["name"],
                email=row["email"],
                mobile_digits=row["mobile_digits"],
                password_hash=row["password_hash"],
            )
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    def get_by_id(self, user_id: str) -> StoredUser | None:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            return None
        return StoredUser(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            mobile_digits=row["mobile_digits"],
            password_hash=row["password_hash"],
        )


_store: AuthStore | None = None


def get_auth_store() -> AuthStore:
    global _store
    if _store is None:
        db_path = Path(
            os.getenv("AUTH_DB_PATH", str(Path("data") / "auth_users.sqlite"))
        )
        _store = AuthStore(db_path.resolve())
    return _store
