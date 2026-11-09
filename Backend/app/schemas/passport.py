from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class PassportEntryCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    destinationId: str = Field(alias="destination_id")
    visitedOn: Optional[str] = Field(default=None, alias="visited_on")
    visibility: Literal["PUBLIC", "PRIVATE"] = "PUBLIC"
