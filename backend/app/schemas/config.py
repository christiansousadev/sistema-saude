from datetime import datetime

from pydantic import BaseModel, model_validator

from app.db.models import EngineMode


class ApiConfigCreate(BaseModel):
    engine_mode: EngineMode = EngineMode.LLM
    api_key: str | None = None
    # model_name é obrigatório apenas para engine_mode=LLM
    model_name: str | None = None
    base_url: str | None = None
    clinical_system_prompt: str | None = None
    physical_system_prompt: str | None = None

    @model_validator(mode="after")
    def validate_llm_fields(self) -> "ApiConfigCreate":
        if self.engine_mode == EngineMode.LLM and not self.model_name:
            raise ValueError("model_name é obrigatório quando engine_mode=LLM")
        return self


class ApiConfigResponse(BaseModel):
    id: int
    user_id: int
    engine_mode: EngineMode
    api_key: str | None
    model_name: str | None
    base_url: str | None
    clinical_system_prompt: str | None
    physical_system_prompt: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
