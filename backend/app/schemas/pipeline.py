from pydantic import BaseModel


class PipelineOut(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}
