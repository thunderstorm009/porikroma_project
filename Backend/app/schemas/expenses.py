from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tripId: str = Field(alias="trip_id")
    title: str = Field(min_length=2)
    category: str = Field(min_length=2)
    amount: int = Field(gt=0)
    expenseDate: Optional[str] = Field(default=None, alias="expense_date")


class SettlementCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    toUserId: str = Field(alias="to_user_id")
    amount: int = Field(gt=0)
    status: Optional[str] = Field(default="PENDING")


class SettlementStatusUpdateRequest(BaseModel):
    status: str

