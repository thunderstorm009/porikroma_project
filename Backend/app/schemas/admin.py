from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class UserRoleUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    role: Literal["TRAVELER", "TOUR_PLANNER", "ADMIN"]


class UserStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: Literal["ACTIVE", "SUSPENDED", "BANNED"]


class VerificationStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    status: Literal["APPROVED", "REJECTED"]


class ReportActionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    action: Literal["DISMISSED", "WARNING", "SUSPENDED", "BANNED"]
    note: Optional[str] = Field(default=None, max_length=2000)


class VerificationCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    note: Optional[str] = Field(default=None, max_length=2000)


class UserReportCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    reason: str = Field(min_length=3, max_length=1000)
