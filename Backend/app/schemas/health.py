from typing import Optional
from pydantic import BaseModel, Field


class HealthStatusResponse(BaseModel):
    status: str = Field(default="ok", examples=["ok"])
    database: Optional[str] = Field(default=None, examples=["ready"])


class ReadinessResponse(BaseModel):
    status: str = Field(default="ready", examples=["ready"])
    database: Optional[str] = Field(default=None, examples=["unavailable"])
