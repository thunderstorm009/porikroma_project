from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class TripCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=2)
    destinationId: str = Field(alias="destination_id")
    startDate: str = Field(alias="start_date")
    endDate: str = Field(alias="end_date")
    visibility: Literal["PUBLIC", "PRIVATE"] = "PRIVATE"
    status: Literal["DRAFT", "PLANNING", "UPCOMING", "COMPLETED", "CANCELLED"] = "PLANNING"
    budget: int = Field(default=0, ge=0)
    description: str = ""


class TripUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=2)
    destinationId: Optional[str] = Field(default=None, alias="destination_id")
    startDate: Optional[str] = Field(default=None, alias="start_date")
    endDate: Optional[str] = Field(default=None, alias="end_date")
    visibility: Optional[Literal["PUBLIC", "PRIVATE"]] = None
    status: Optional[Literal["DRAFT", "PLANNING", "UPCOMING", "COMPLETED", "CANCELLED"]] = None
    budget: Optional[int] = Field(default=None, ge=0)
    description: Optional[str] = None


class TripStatusUpdateRequest(BaseModel):
    status: Literal["DRAFT", "PLANNING", "UPCOMING", "COMPLETED", "CANCELLED"]


class ItineraryItemCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dayDate: str = Field(alias="day_date")
    title: str = Field(min_length=2)
    location: Optional[str] = None
    notes: str = ""
    sortOrder: int = Field(default=0, alias="sort_order")


class ItineraryItemUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dayDate: Optional[str] = Field(default=None, alias="day_date")
    title: Optional[str] = Field(default=None, min_length=2)
    location: Optional[str] = None
    notes: Optional[str] = None
    sortOrder: Optional[int] = Field(default=None, alias="sort_order")


class ChecklistItemCreateRequest(BaseModel):
    title: str = Field(min_length=1)


class ChecklistItemUpdateRequest(BaseModel):
    completed: bool


class TripNoteCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class TripMapPlaceCreateRequest(BaseModel):
    name: str = Field(min_length=2)
    category: str = "Attraction"
    notes: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None


class TripMemberAddRequest(BaseModel):
    email: str


class TripPhotoCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: str
    caption: str = ""
    taken_at: Optional[str] = Field(default=None, alias="takenAt")
