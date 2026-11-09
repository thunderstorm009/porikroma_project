from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=2)
    username: Optional[str] = Field(default=None, pattern=r"^[a-z0-9-]+$")
    bio: str = Field(default="", max_length=2000)
    avatarUrl: Optional[str] = Field(default=None, alias="avatar_url")
    travelStyle: Optional[str] = Field(default=None, max_length=100, alias="travel_style")
    interests: List[str] = Field(default_factory=list, max_length=20)


class PrivacySettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    profileVisibility: Literal["PUBLIC", "PRIVATE"] = Field(
        alias="profile_visibility"
    )
    travelHistoryVisibility: Literal["PUBLIC", "PRIVATE"] = Field(
        alias="travel_history_visibility"
    )
    footprintVisibility: Literal["PUBLIC", "PRIVATE"] = Field(
        alias="footprint_visibility"
    )
    reviewsVisibility: Literal["PUBLIC", "PRIVATE"] = Field(
        alias="reviews_visibility"
    )
