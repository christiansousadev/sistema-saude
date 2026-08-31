from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' ou 'assistant'")
    content: str


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_history: list[ChatMessage] = Field(default_factory=list)


class AssistantChatResponse(BaseModel):
    reply: str
    context_used: dict[str, Any]
    disclaimer: str = (
        "Atenção: As respostas da assistente de saúde têm caráter puramente informativo e "
        "educacional, baseadas no histórico registrado. Nunca substitua orientações médicas profissionais."
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)
