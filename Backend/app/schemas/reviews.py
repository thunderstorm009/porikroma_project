from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class PeerReviewCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tripId: str = Field(alias="trip_id")
    revieweeId: str = Field(alias="reviewee_id")
    rating: int
    comment: str = Field(default="")
