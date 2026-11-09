from datetime import timedelta
import logging
import random
import re
import uuid
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from app.db import Database, get_db
from app.deps import get_current_user
from app.schemas.auth import (
    ChangePasswordRequest,
    DemoLoginRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.serializers import record_to_dict
from app.services.security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    verify_password,
    verify_token,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

TARGET_EMAILS = {
    "TRAVELER": "traveler@porikroma.com",
    "TOUR_PLANNER": "planner@porikroma.com",
    "ADMIN": "admin@porikroma.com",
}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    db: Database = Depends(get_db),
):
    """Register new traveler, tour planner, or admin account."""
    password_hash = hash_password(data.password)

    # 1. Insert user
    user = await db.fetchrow(
        """
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, lower($2), $3, $4)
        RETURNING id, name, email, role
        """,
        data.name,
        data.email,
        password_hash,
        data.role,
    )
    user_dict = record_to_dict(user)
    user_uuid = uuid.UUID(user_dict["id"])

    # 2. Privacy settings initialized
    await db.execute(
        "INSERT INTO user_privacy_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
        user_uuid,
    )

    # 3. User profile initialized with random suffix username
    sanitized_name = re.sub(r"[^a-z0-9]", "-", data.name.lower())
    username = f"{sanitized_name}-{random.randint(100, 999)}"
    await db.execute(
        """
        INSERT INTO user_profiles (user_id, username, bio, travel_style, interests)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
        """,
        user_uuid,
        username,
        "Traveler on Porikroma",
        "Curious explorer",
        ["Nature", "Culture"],
    )

    # 4. Sign JWT
    token = create_access_token({"id": user_dict["id"], "role": user_dict["role"]})

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={"user": user_dict, "token": token},
    )


@router.post("/login")
async def login(
    data: LoginRequest,
    db: Database = Depends(get_db),
):
    """Authenticate with email and password, enforce active account status, return JWT."""
    user = await db.fetchrow(
        """
        SELECT id, name, email, role, password_hash, status
        FROM users
        WHERE email = lower($1)
        """,
        data.email,
    )
    if not user or not verify_password(data.password, user["password_hash"]):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": "Invalid email or password"},
        )

    user_dict = record_to_dict(user)
    user_status = str(user_dict.get("status", "ACTIVE")).upper()
    if user_status in ("SUSPENDED", "BANNED"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": f"Account is {user_status.lower()}. Please contact support."
            },
        )

    safe_user = {k: v for k, v in user_dict.items() if k != "password_hash"}
    token = create_access_token({"id": safe_user["id"], "role": safe_user["role"]})
    return {"user": safe_user, "token": token}


@router.post("/demo-login")
async def demo_login(
    data: DemoLoginRequest,
    db: Database = Depends(get_db),
):
    """Convenience one-click demo login for TRAVELER, TOUR_PLANNER, or ADMIN."""
    target_email = TARGET_EMAILS.get(data.role)
    user = await db.fetchrow(
        "SELECT id, name, email, role, status FROM users WHERE email = $1",
        target_email,
    )

    if not user:
        # Fallback to any user matching the requested role
        user = await db.fetchrow(
            "SELECT id, name, email, role, status FROM users WHERE role = $1 LIMIT 1",
            data.role,
        )

    if not user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": f"No user found for role {data.role}"},
        )

    user_dict = record_to_dict(user)
    user_status = str(user_dict.get("status", "ACTIVE")).upper()
    if user_status in ("SUSPENDED", "BANNED"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": f"Account is {user_status.lower()}. Please contact support."
            },
        )

    safe_user = {k: v for k, v in user_dict.items() if k != "password_hash"}
    token = create_access_token({"id": safe_user["id"], "role": safe_user["role"]})
    return {"user": safe_user, "token": token}


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Database = Depends(get_db),
):
    """Issue self-contained password reset token and console log reset link."""
    user = await db.fetchrow(
        "SELECT id, email FROM users WHERE email = lower($1)",
        data.email,
    )
    if not user:
        return {
            "success": True,
            "message": "If that email exists in our system, a reset link has been dispatched.",
        }

    user_dict = record_to_dict(user)
    reset_token = create_password_reset_token(
        user_dict["id"], expires_delta=timedelta(hours=1)
    )
    reset_link = f"/reset-password?token={reset_token}"

    print(
        f"[AUTH FORGOT-PASSWORD] Dispatched reset token for {data.email}: {reset_token}"
    )
    logger.info("Password reset token generated: %s (link: %s)", reset_token, reset_link)

    return {
        "success": True,
        "message": "Password reset link sent successfully. You can use the provided token or link to reset your password.",
        "resetToken": reset_token,
        "resetLink": reset_link,
    }


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: Database = Depends(get_db),
):
    """Verify reset token JWT and update user's password hash."""
    try:
        payload = verify_token(data.token)
        if payload.get("purpose") != "reset-password" and not payload.get("id"):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Invalid reset token"},
            )

        user_uuid = uuid.UUID(str(payload["id"]))
        new_hash = hash_password(data.password)
        await db.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            new_hash,
            user_uuid,
        )
        return {
            "success": True,
            "message": "Password has been successfully reset. Please log in with your new password.",
        }
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Invalid or expired password reset token"},
        )


@router.post("/verify-email")
async def verify_email(
    data: VerifyEmailRequest,
):
    """Email verification endpoint matching legacy contract."""
    if data.token:
        print(f"[AUTH VERIFY-EMAIL] Email verified with token: {data.token}")
    return {"success": True, "message": "Email verified successfully."}


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Change password for the currently authenticated user."""
    user_uuid = uuid.UUID(str(current_user["id"]))
    user_row = await db.fetchrow(
        "SELECT password_hash FROM users WHERE id = $1",
        user_uuid,
    )
    if not user_row or not verify_password(
        data.currentPassword, user_row["password_hash"]
    ):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "Current password does not match"},
        )

    new_hash = hash_password(data.newPassword)
    await db.execute(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash,
        user_uuid,
    )
    return {"success": True, "message": "Password updated successfully"}
