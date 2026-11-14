"""Трассировка ответов агента для аудита и отладки."""
import json
import time
import uuid
from datetime import datetime
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.events import AgentTrace


class TraceRecorder:
    """Записывает трассировку ответа агента в БД."""
    
    def __init__(self, session_id: str, user_message: str):
        # session_id теперь просто строка — может быть любым идентификатором
        self.session_id = str(session_id) if session_id else str(uuid.uuid4())
        self.user_message = user_message
        self.trace_id = uuid.uuid4()
        self.start_time = time.time()
        self.plan: list[dict] = []
        self.tool_calls: list[dict] = []
        self.response: str = ""
        self.event_ids: list[str] = []
        self.tokens_used: int = 0
        self.model: str = ""
    
    def add_plan_step(self, step: dict):
        """Добавляет шаг плана агента."""
        self.plan.append(step)
    
    def add_tool_call(self, tool_name: str, args: dict, result: Any, duration_ms: float):
        """Записывает вызов инструмента."""
        self.tool_calls.append({
            "tool": tool_name,
            "args": args,
            "result_preview": str(result)[:500],  # Обрезаем для экономии места
            "duration_ms": round(duration_ms, 2),
        })
    
    def set_response(self, response: str, event_ids: list[str] = None):
        """Устанавливает финальный ответ и ID упомянутых событий."""
        self.response = response
        self.event_ids = event_ids or []
    
    def set_tokens(self, tokens: int, model: str):
        """Устанавливает информацию о токенах."""
        self.tokens_used = tokens
        self.model = model
    
    async def save(self, db: AsyncSession):
        """Сохраняет трассировку в БД."""
        latency_ms = int((time.time() - self.start_time) * 1000)
        
        cost_rub = (self.tokens_used / 1000) * 0.06 if self.tokens_used else 0
        
        trace = AgentTrace(
            id=self.trace_id,
            session_id=self.session_id,  # Просто строка, без UUID()
            user_message=self.user_message,
            plan=json.dumps(self.plan, ensure_ascii=False) if self.plan else None,
            tool_calls=json.dumps(self.tool_calls, ensure_ascii=False) if self.tool_calls else None,
            response=self.response,
            event_ids=[uuid.UUID(eid) for eid in self.event_ids] if self.event_ids else None,
            latency_ms=latency_ms,
            tokens_used=self.tokens_used,
            cost_rub=cost_rub,
            model=self.model,
        )
        db.add(trace)
        await db.commit()
        
        return {
            "trace_id": str(self.trace_id),
            "latency_ms": latency_ms,
            "tokens_used": self.tokens_used,
            "cost_rub": round(cost_rub, 4),
        }