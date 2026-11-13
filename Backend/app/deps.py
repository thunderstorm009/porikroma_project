from typing import Any, Callable, Dict, List, Optional
import uuid
import jwt
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.db import Database, get_db
from app.serializers import record_to_dict
from app.services.security import verify_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Database = Depends(get_db),
) -> Dict[str, Any]:
    """
    Authenticate user via Bearer token:
    1. Read and verify Bearer token (HS256).
    2. Load user from database by ID.
    3. Reject suspended or banned accounts (HTTP 403).
    4. Return loaded user record as dictionary.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = verify_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("id") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: invalid user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.fetchrow(
        """
        SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
               coalesce(up.avatar_url, '') AS avatar_url,
               coalesce(up.avatar_url, '') AS avatar,
               EXISTS (
                   SELECT 1 FROM verification_requests vr
                   WHERE vr.user_id = u.id AND vr.status = 'APPROVED'
               ) AS is_verified
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id = $1
        """,
        user_uuid,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_dict = record_to_dict(user)
    user_status = str(user_dict.get("status", "ACTIVE")).upper()
    if user_status in ("SUSPENDED", "BANNED"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user_status.lower()}. Please contact support.",
        )

    request.state.user = user_dict
    return user_dict


async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Database = Depends(get_db),
) -> Optional[Dict[str, Any]]:
    """Optionally extract user if valid token present, otherwise None."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None


def require_role(role: str, error_message: Optional[str] = None) -> Callable:
    """
    Dependency checking user role:
    - ADMIN: only ADMIN permitted. Error: 'Admin role required'
    - TOUR_PLANNER: TOUR_PLANNER and ADMIN permitted. Error: 'Tour planner role required'
    - TRAVELER: TRAVELER, TOUR_PLANNER, and ADMIN permitted. Error: 'Traveler role required'
    """
    target_role = role.upper()

    async def role_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        user_role = str(current_user.get("role", "")).upper()

        if target_role == "ADMIN":
            if user_role != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message or "Admin role required",
                )
        elif target_role == "TOUR_PLANNER":
            if user_role not in ("TOUR_PLANNER", "ADMIN"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message or "Tour planner role required",
                )
        elif target_role == "TRAVELER":
            if user_role not in ("TRAVELER", "TOUR_PLANNER", "ADMIN"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message or "Traveler role required",
                )
        else:
            if user_role != target_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=error_message or "Permission denied",
                )

        return current_user

    return role_checker


def require_roles(*allowed_roles: str, error_message: Optional[str] = None) -> Callable:
    """Dependency checking user has at least one of the allowed roles (ADMIN always allowed)."""
    normalized_roles = {r.upper() for r in allowed_roles}

    async def roles_checker(
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        user_role = str(current_user.get("role", "")).upper()
        if user_role not in normalized_roles and user_role != "ADMIN":
            default_msg = (
                "Tour planner role required"
                if "TOUR_PLANNER" in normalized_roles
                else "Permission denied"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_message or default_msg,
            )
        return current_user

    return roles_checker


require_admin = require_role("ADMIN")
require_tour_planner = require_role("TOUR_PLANNER")
require_traveler = require_role("TRAVELER")
