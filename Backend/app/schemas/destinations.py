from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DestinationCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=2)
    division: str = Field(min_length=2)
    district: str = Field(min_length=2)
    description: str = Field(min_length=10)
    category: str = Field(min_length=2)
    estimatedBudget: int = Field(ge=0, alias="estimated_budget")
    image: Optional[str] = None


class DestinationUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=2)
    division: str = Field(min_length=2)
    district: str = Field(min_length=2)
    description: str = Field(min_length=10)
    category: str = Field(min_length=2)
    estimatedBudget: int = Field(ge=0, alias="estimated_budget")
    image: Optional[str] = None


class ReviewCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    destinationId: str = Field(alias="destination_id")
    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=2)
