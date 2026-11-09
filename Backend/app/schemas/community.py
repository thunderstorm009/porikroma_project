from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class PostCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(min_length=1, max_length=10000)
    visibility: Literal["PUBLIC", "FOLLOWERS_ONLY"] = "PUBLIC"


class CommentCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(min_length=1, max_length=2000)
    parentId: Optional[str] = Field(default=None, alias="parent_id")


class ReplyCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(min_length=1, max_length=2000)
