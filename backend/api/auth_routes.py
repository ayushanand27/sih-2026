"""JWT login/register for the SIH prototype UI."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from api.auth_store import get_auth_store

router = APIRouter(prefix="/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=False)

AUTH_SECRET = os.getenv(
    "AUTH_SECRET", "change-me-in-production-use-long-random-string"
)
TOKEN_TTL_HOURS = int(os.getenv("AUTH_TOKEN_TTL_HOURS", "168"))


class LoginRequest(BaseModel):
    identifier: str = Field(
        min_length=1,
        description="Email address or mobile number (digits only, no country code required).",
    )
    password: str = Field(min_length=1)
    remember_me: bool = True


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    mobile: str = Field(min_length=7, description="Mobile number; country code optional.")
    password: str = Field(min_length=6)


class AuthUserResponse(BaseModel):
    id: str
    name: str
    identifier: str
    email: str | None = None
    mobile: str | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUserResponse


class MessageResponse(BaseModel):
    message: str


def _display_identifier(email: str | None, mobile_digits: str | None) -> str:
    if email:
        return email
    if mobile_digits:
        return f"+91 {mobile_digits}"
    return "account"


def _user_response(user) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        name=user.name,
        identifier=_display_identifier(user.email, user.mobile_digits),
        email=user.email,
        mobile=user.mobile_digits,
    )


def create_access_token(*, user_id: str, name: str, remember_me: bool) -> tuple[str, int]:
    ttl_hours = TOKEN_TTL_HOURS if remember_me else min(TOKEN_TTL_HOURS, 24)
    expires_delta = timedelta(hours=ttl_hours)
    expires_at = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": user_id,
        "name": name,
        "exp": expires_at,
    }
    token = jwt.encode(payload, AUTH_SECRET, algorithm="HS256")
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, AUTH_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthUserResponse:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated.")
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session.")
    stored = get_auth_store().get_by_id(str(user_id))
    if stored is None:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return _user_response(stored)


@router.post("/login", response_model=AuthTokenResponse)
def login(body: LoginRequest) -> AuthTokenResponse:
    user = get_auth_store().authenticate(body.identifier, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect email/mobile or password.")
    token, expires_in = create_access_token(
        user_id=user.id, name=user.name, remember_me=body.remember_me
    )
    return AuthTokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=_user_response(user),
    )


@router.post("/register", response_model=AuthTokenResponse, status_code=201)
def register(body: RegisterRequest) -> AuthTokenResponse:
    try:
        user = get_auth_store().register(
            name=body.name,
            email=body.email,
            mobile=body.mobile,
            password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    token, expires_in = create_access_token(
        user_id=user.id, name=user.name, remember_me=True
    )
    return AuthTokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=_user_response(user),
    )


@router.get("/me", response_model=AuthUserResponse)
def me(current: Annotated[AuthUserResponse, Depends(get_current_user)]) -> AuthUserResponse:
    return current


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password() -> MessageResponse:
    return MessageResponse(
        message=(
            "Password reset is not enabled in this demo. "
            "Contact your SIH facilitator or use the demo account documented in the README."
        )
    )


@router.get("/demo-hint", response_model=MessageResponse)
def demo_hint() -> MessageResponse:
    phone = os.getenv("DEMO_LOGIN_PHONE", "9876543210")
    return MessageResponse(
        message=f"Demo login: mobile {phone} with password from DEMO_LOGIN_PASSWORD (default demo123)."
    )
