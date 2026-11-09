from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class TourCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    destinationId: str = Field(alias="destination_id")
    title: str = Field(min_length=2)
    description: str = Field(min_length=10)
    price: int = Field(ge=0)
    capacity: int = Field(gt=0)
    status: Literal["DRAFT", "PUBLISHED", "ARCHIVED"] = "DRAFT"


class TourUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    destinationId: Optional[str] = Field(default=None, alias="destination_id")
    title: Optional[str] = Field(default=None, min_length=2)
    description: Optional[str] = Field(default=None, min_length=10)
    price: Optional[int] = Field(default=None, ge=0)
    capacity: Optional[int] = Field(default=None, gt=0)
    status: Optional[Literal["DRAFT", "PUBLISHED", "ARCHIVED"]] = None


class DepartureCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    startDate: str = Field(alias="start_date")
    endDate: str = Field(alias="end_date")
    capacity: int = Field(gt=0)
    status: Literal["OPEN", "FULL", "CANCELLED", "COMPLETED"] = "OPEN"


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    travelersCount: int = Field(default=1, gt=0, alias="travelers_count")
    status: Optional[Literal["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]] = None


class BookingStatusUpdateRequest(BaseModel):
    status: Literal["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]
