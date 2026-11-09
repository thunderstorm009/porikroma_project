from pydantic import BaseModel, ConfigDict, Field


class ConversationCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(default="New travel session", min_length=1, max_length=200)


class MessageCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(min_length=1, max_length=10000)
