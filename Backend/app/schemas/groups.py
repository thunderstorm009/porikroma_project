from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class GroupCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tripId: str = Field(alias="trip_id")
    title: str = Field(min_length=2)
    capacity: int = Field(gt=0)
    budgetPerPerson: int = Field(default=0, ge=0, alias="budget_per_person")
    published: bool = True


class ApplicationStatusUpdateRequest(BaseModel):
    status: Literal["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]


class GroupMessageCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
