"""Подключение к LLM-провайдерам."""
from langchain_core.language_models.chat_models import BaseChatModel
from app.config import get_settings


def get_llm(temperature: float | None = None) -> BaseChatModel:
    """Возвращает LLM-клиент в зависимости от провайдера."""
    settings = get_settings()
    temp = temperature if temperature is not None else settings.llm_temperature
    
    provider = settings.llm_provider.lower().strip()

    if provider == "yandexgpt":
        from langchain_openai import ChatOpenAI
        
        return ChatOpenAI(
            model=settings.yandexgpt_model,  # Теперь здесь полный URI: gpt://.../yandexgpt-lite
            api_key=settings.yandexgpt_api_key,
            base_url=settings.yandexgpt_base_url,  # https://ai.api.cloud.yandex.net/v1
            temperature=temp,
            max_tokens=settings.llm_max_tokens,
            default_headers={
                "x-folder-id": settings.yandexgpt_folder_id,
            },
        )
        
    elif provider == "gigachat":
        try:
            from langchain_gigachat.chat_models import GigaChat
            return GigaChat(
                credentials=settings.gigachat_api_key,
                model=settings.gigachat_model or "GigaChat",
                temperature=temp,
                max_tokens=settings.llm_max_tokens,
                verify_ssl_certs=False,
            )
        except ImportError:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="GigaChat",
                api_key=settings.gigachat_api_key,
                base_url="https://gigachat.devices.sberbank.ru/api/v1",
                temperature=temp,
                max_tokens=settings.llm_max_tokens,
            )
            
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=temp,
            max_tokens=settings.llm_max_tokens,
        )
        
    else:
        raise ValueError(f"Unknown LLM provider: '{settings.llm_provider}'. Use 'yandexgpt', 'gigachat', or 'openai'.")