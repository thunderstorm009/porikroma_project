from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from app.config import settings

BCRYPT_ROUNDS = 10
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash password using bcrypt with 10 rounds."""
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hash (supports $2a$ from bcryptjs and $2b$)."""
    try:
        hashed_bytes = (
            hashed_password.encode("utf-8")
            if isinstance(hashed_password, str)
            else hashed_password
        )
        plain_bytes = (
            plain_password.encode("utf-8")
            if isinstance(plain_password, str)
            else plain_password
        )
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create HS256 JWT access token with payload data (e.g. id, role)."""
    to_encode = data.copy()
    if expires_delta is not None:
        expire = datetime.now(timezone.utc) + expires_delta
        to_encode["exp"] = int(expire.timestamp())
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_password_reset_token(
    user_id: str,
    expires_delta: timedelta = timedelta(hours=1),
) -> str:
    """Create password reset token matching legacy backend payload."""
    payload = {
        "id": str(user_id),
        "purpose": "reset-password",
    }
    return create_access_token(payload, expires_delta=expires_delta)


def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode HS256 JWT token."""
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[ALGORITHM],
        options={"verify_signature": True},
    )


def decode_token(token: str) -> Dict[str, Any]:
    """Alias for verify_token."""
    return verify_token(token)
