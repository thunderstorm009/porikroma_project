from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, description="User full name")
    email: EmailStr = Field(description="Unique email address")
    password: str = Field(min_length=6, description="Password min 6 chars")
    role: Literal["TRAVELER", "TOUR_PLANNER", "ADMIN"] = "TRAVELER"

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 2:
            raise ValueError("String should have at least 2 characters")
        return trimmed


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class DemoLoginRequest(BaseModel):
    role: Literal["TRAVELER", "TOUR_PLANNER", "ADMIN"]


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    password: str = Field(min_length=6)


class VerifyEmailRequest(BaseModel):
    token: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    currentPassword: str = Field(min_length=1, alias="current_password")
    newPassword: str = Field(min_length=6, alias="new_password")


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class StatusResponse(BaseModel):
    success: bool = True
    message: str
    resetToken: Optional[str] = None
    resetLink: Optional[str] = None
