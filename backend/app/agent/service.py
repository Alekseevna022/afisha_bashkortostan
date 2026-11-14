"""Главный сервис ИИ-агента."""
import asyncio
import uuid
import json
import re
from typing import Optional
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.graph import agent_graph
from app.agent.tracer import TraceRecorder
from app.agent.guard import check_injection
from app.agent.context import extract_context_from_history
from app.agent.tools import search_events
from app.config import get_settings
from app.database import AsyncSessionLocal


class AgentService:
    @staticmethod
    async def chat(
        user_message: str,
        session_id: Optional[str] = None,
        history: Optional[list[dict]] = None,
    ) -> dict:
        settings = get_settings()
        
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # 1. Проверка на инъекции
        injection_check = check_injection(user_message)
        if injection_check:
            return {
                "reply": "Я отвечаю только на вопросы о культурных мероприятиях Башкортостана.",
                "events": [],
                "trace_id": None,
                "session_id": session_id,
                "fallback": False,
                "blocked": True,
            }
        
        trace = TraceRecorder(session_id=session_id, user_message=user_message)
        
        # 2. Формируем историю
        messages = []
        if history:
            for msg in history[-10:]:
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    if msg["role"] == "user":
                        messages.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        messages.append(AIMessage(content=msg["content"]))
        
        messages.append(HumanMessage(content=user_message))
        context = extract_context_from_history(history or [])
        
        initial_state = {
            "messages": messages,
            "trace": trace,
            "fallback": False,
            "context": context,
        }
        
        try:
            # 3. Основной вызов LLM
            result = await asyncio.wait_for(
                agent_graph.ainvoke(initial_state),
                timeout=settings.agent_timeout_sec
            )
            
            final_message = result["messages"][-1]
            response_text = final_message.content if hasattr(final_message, "content") else str(final_message)
            
            event_ids = re.findall(
                r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b',
                response_text
            )
            trace.set_response(response_text, event_ids)
            
            async with AsyncSessionLocal() as db:
                trace_meta = await trace.save(db)
            
            return {
                "reply": response_text,
                "events": [{"id": eid} for eid in event_ids],
                "trace_id": str(trace.trace_id),
                "session_id": session_id,
                "fallback": result.get("fallback", False),
                "blocked": False,
                **trace_meta,
            }
            
        except (asyncio.TimeoutError, Exception) as e:
            # 4. РЕЗЕРВНЫЙ РЕЖИМ
            error_type = "timeout" if isinstance(e, asyncio.TimeoutError) else "error"
            print(f"FALLBACK TRIGGERED: {type(e).__name__}: {e}")
            
            # Умный fallback: используем только город/категорию из контекста
            fallback_params = {"limit": 10}
            if context.get("city"):
                fallback_params["city"] = context["city"]
            if context.get("category"):
                fallback_params["category"] = context["category"]
            if context.get("is_free") is not None:
                fallback_params["is_free"] = context["is_free"]
            
            # Если контекст пустой, ищем просто последние события
            if not context.get("city") and not context.get("category"):
                fallback_params["limit"] = 5

            try:
                fallback_result = search_events.func(**fallback_params)
                fallback_data = json.loads(fallback_result)
                
                if fallback_data.get("found", 0) > 0:
                    lines = []
                    for ev in fallback_data["events"][:5]:
                        title = ev.get("title", "Без названия")
                        date = (ev.get("date_start") or "")[:10]
                        city = ev.get("city", "")
                        price = "бесплатно" if ev.get("is_free") else str(ev.get("price_min", 0)) + "-" + str(ev.get("price_max", 0)) + " руб"
                        age = ev.get("age_limit", 0)
                        line = f"**{title}** ({date}, {city})\nЦена: {price} | Возраст: {age}+"
                        lines.append(line)
                    events_text = "\n\n".join(lines)
                    response_text = "ИИ-ассистент временно работает в упрощенном режиме. Вот что есть в афише:\n\n" + events_text
                else:
                    response_text = "ИИ-ассистент временно работает в упрощенном режиме. По вашим фильтрам ничего не найдено."
            except Exception as fallback_error:
                print(f"FALLBACK ALSO FAILED: {fallback_error}")
                response_text = "Сервис временно недоступен. Попробуйте позже."
            
            trace.set_response(response_text)
            async with AsyncSessionLocal() as db:
                trace_meta = await trace.save(db)
            
            return {
                "reply": response_text,
                "events": [],
                "trace_id": str(trace.trace_id),
                "session_id": session_id,
                "fallback": True,
                "blocked": False,
                "fallback_reason": error_type,
                **trace_meta,
            }