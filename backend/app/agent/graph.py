"""LangGraph граф ИИ-агента."""
import json
import re
from typing import Annotated, TypedDict, Literal
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from app.agent.llm import get_llm
from app.agent.tools import ALL_TOOLS
from app.agent.prompts import get_system_prompt
from app.agent.tracer import TraceRecorder


class AgentState(TypedDict):
    """Состояние агента."""
    messages: Annotated[list, add_messages]
    trace: TraceRecorder
    fallback: bool  # Режим резервного поиска
    context: dict


def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Определяет, нужно ли вызывать инструменты или закончить."""
    last_message = state["messages"][-1]
    
    # Если есть вызовы инструментов — идём в tools
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    
    # Иначе — конец
    return "end"


def call_model(state: AgentState) -> dict:
    """Вызов LLM с инструментами."""
    llm = get_llm()
    llm_with_tools = llm.bind_tools(ALL_TOOLS)
    
    # Получаем контекст из состояния
    context = state.get("context", {})
    
    # Добавляем системный промпт с контекстом
    messages = [SystemMessage(content=get_system_prompt(context))] + state["messages"]
    
    response = llm_with_tools.invoke(messages)
    
    # Подсчёт токенов (примерно)
    tokens = len(str(response.content)) // 4 + sum(len(str(tc)) // 4 for tc in (response.tool_calls or []))
    
    model_name = getattr(llm, "model_name", None) or \
                 getattr(llm, "model", None) or \
                 llm.__class__.__name__
    state["trace"].set_tokens(tokens, model_name)
    
    # Записываем план
    if response.tool_calls:
        for tc in response.tool_calls:
            state["trace"].add_plan_step({
                "step": "tool_call",
                "tool": tc["name"],
                "args": tc["args"],
            })
    
    return {"messages": [response]}


def _extract_hard_filters(user_text: str) -> dict:
    """
    Извлекает обязательные фильтры непосредственно
    из запроса пользователя.
    """
    text = user_text.lower().replace("ё", "е")
    filters = {}

    # Цена
    if re.search(
        r"\b(бесплатно|бесплатные|бесплатный|бесплатная|без оплаты)\b",
        text
    ):
        filters["is_free"] = True

    elif re.search(
        r"\b(платно|платные|платный|платная|за деньги)\b",
        text
    ):
        filters["is_free"] = False

    # Возраст 12+, 16+, 18+
    age_plus = re.search(r"\b(\d{1,2})\s*\+", text)

    if age_plus:
        filters["age_min"] = int(age_plus.group(1))

    # Возраст до определённого значения
    age_max = re.search(
        r"\bдо\s*(\d{1,2})\s*(?:лет|года|год)?\b",
        text
    )

    child_age = re.search(
        r"(?:ребенку|ребёнку|ребенка|ребёнка|детям)\s*(\d{1,2})\s*(?:лет|года|год)",
        text
    )

    if age_max:
        filters["age_max"] = int(age_max.group(1))

    elif child_age:
        filters["age_max"] = int(child_age.group(1))

    elif not age_plus and re.search(
        r"\b(для детей|детям|детский|детская)\b",
        text
    ):
        filters["age_max"] = 12

    elif not age_plus and re.search(
        r"\b(для взрослых|взрослым|взрослые)\b",
        text
    ):
        filters["age_min"] = 18

    return filters


def tool_executor(state: AgentState) -> dict:
    """Выполнение инструментов с принудительной фильтрацией."""

    last_user_message = ""

    for message in reversed(state["messages"]):
        if isinstance(message, HumanMessage):
            last_user_message = str(message.content)
            break

    hard_filters = _extract_hard_filters(last_user_message)

    # Принудительно добавляем фильтры в вызов поиска
    last_message = state["messages"][-1]

    if hasattr(last_message, "tool_calls"):
        for tool_call in last_message.tool_calls:
            if tool_call["name"] == "search_events":
                tool_call["args"].update(hard_filters)

    tool_node = ToolNode(ALL_TOOLS)
    result = tool_node.invoke(state)

    # Записываем вызовы инструментов
    if hasattr(last_message, "tool_calls"):
        for i, tc in enumerate(last_message.tool_calls):
            tool_result = (
                result["messages"][i]
                if i < len(result["messages"])
                else None
            )

            state["trace"].add_tool_call(
                tool_name=tc["name"],
                args=tc["args"],
                result=tool_result.content if tool_result else "",
                duration_ms=0,
            )

    return {"messages": result["messages"]}


def fallback_responder(state: AgentState) -> dict:
    """Резервный режим: обычный поиск без LLM."""
    last_message = state["messages"][-1]
    user_text = last_message.content if hasattr(last_message, "content") else str(last_message)
    
    # Простой поиск по ключевым словам
    from app.agent.tools import search_events
    result = search_events.invoke({"query": user_text, "limit": 5})
    
    response_text = f"ИИ-ассистент временно недоступен. Вот что нашлось по вашему запросу:\n\n{result}"
    
    state["trace"].set_response(response_text)
    
    return {"messages": [AIMessage(content=response_text)], "fallback": True}


def build_agent_graph():
    """Строит граф агента."""
    workflow = StateGraph(AgentState)
    
    # Добавляем узлы (имя узла не должно совпадать с ключами AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_executor)
    workflow.add_node("fallback_responder_node", fallback_responder)  # <-- ИЗМЕНЕНО
    
    # Связи
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    workflow.add_edge("tools", "agent")  # После инструментов — снова к модели
    
    return workflow.compile()


# Глобальный экземпляр графа
agent_graph = build_agent_graph()