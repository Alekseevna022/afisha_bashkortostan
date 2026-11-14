import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.users import User


router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Авторизация"],
)

settings = get_settings()

TOKEN_TTL = 60 * 60 * 24 * 7


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=160)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()

        if (
            len(value) > 320
            or "@" not in value
            or value.startswith("@")
            or value.endswith("@")
            or "." not in value.rsplit("@", 1)[-1]
        ):
            raise ValueError("Укажи корректный email")

        return value


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


def encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(
        value + "=" * (-len(value) % 4)
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)

    result = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        600_000,
    )

    return f"{encode(salt)}${encode(result)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_text, hash_text = stored_hash.split("$", 1)

        salt = decode(salt_text)
        expected = decode(hash_text)

        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt,
            600_000,
        )

        return hmac.compare_digest(actual, expected)

    except (ValueError, TypeError):
        return False


def create_token(user_id: str) -> str:
    if not settings.auth_secret:
        raise HTTPException(
            status_code=503,
            detail="AUTH_SECRET не настроен на сервере",
        )

    payload = encode(
        json.dumps(
            {
                "sub": user_id,
                "exp": int(time.time()) + TOKEN_TTL,
            }
        ).encode()
    )

    signature = encode(
        hmac.new(
            settings.auth_secret.encode(),
            payload.encode(),
            hashlib.sha256,
        ).digest()
    )

    return f"{payload}.{signature}"


def verify_token(token: str) -> str:
    try:
        if not settings.auth_secret:
            raise ValueError("AUTH_SECRET не настроен")

        payload, signature = token.split(".", 1)

        expected = encode(
            hmac.new(
                settings.auth_secret.encode(),
                payload.encode(),
                hashlib.sha256,
            ).digest()
        )

        if not hmac.compare_digest(signature, expected):
            raise ValueError("Неверная подпись")

        data = json.loads(decode(payload))

        if int(data["exp"]) < int(time.time()):
            raise ValueError("Токен истёк")

        return data["sub"]

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Сессия недействительна. Войди снова.",
        )


def user_response(user: User):
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "created_at": (
            user.created_at.isoformat()
            if user.created_at
            else None
        ),
    }


def session_response(user: User):
    return {
        "access_token": create_token(str(user.id)),
        "token_type": "bearer",
        "user": user_response(user),
    }


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Необходим вход в аккаунт",
        )

    user_id = verify_token(authorization[7:])

    try:
        parsed_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(401, "Некорректный токен")

    user = await db.get(User, parsed_id)

    if not user or not user.is_active:
        raise HTTPException(401, "Пользователь не найден")

    return user


@router.post("/register")
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(
        select(User).where(User.email == payload.email)
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Этот email уже зарегистрирован",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip() or None,
    )

    db.add(user)

    try:
        await db.commit()
        await db.refresh(user)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Не удалось создать аккаунт. Возможно, email уже занят.",
        )

    return session_response(user)


@router.post("/login")
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(
        select(User).where(User.email == payload.email)
    )

    if (
        not user
        or not user.is_active
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный email или пароль",
        )

    return session_response(user)


@router.get("/me")
async def me(
    user: User = Depends(get_current_user),
):
    return {"user": user_response(user)}