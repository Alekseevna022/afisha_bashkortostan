"""API endpoints для ИИ-агента."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.agent.service import AgentService

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: Optional[list[dict]] = None


class ChatResponse(BaseModel):
    reply: str
    events: list[dict]
    trace_id: Optional[str] = None
    session_id: str
    fallback: bool
    blocked: bool
    latency_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    cost_rub: Optional[float] = None


@router.post("/chat", response_model=ChatResponse)
async def agent_chat(request: ChatRequest):
    """
    Чат с ИИ-агентом.
    
    Принимает сообщение пользователя и историю диалога, возвращает ответ агента.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")
    
    result = await AgentService.chat(
        user_message=request.message,
        session_id=request.session_id,
        history=request.history,
    )
    
    return ChatResponse(**result)


@router.get("/health")
async def agent_health():
    """Проверка работоспособности агента."""
    from app.agent.llm import get_llm
    
    try:
        llm = get_llm()
        # Простой тестовый запрос
        response = llm.invoke("Привет")
        
        # Безопасно получаем имя модели (у разных провайдеров разные атрибуты)
        model_name = getattr(llm, "model_name", None) or \
                     getattr(llm, "model", None) or \
                     llm.__class__.__name__
        
        return {"status": "ok", "provider": model_name}
    except Exception as e:
        return {"status": "error", "error": str(e)}