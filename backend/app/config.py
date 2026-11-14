from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    telegram_bot_token: str = ""

    # Адрес сайта
    site_url: str = "http://localhost:3000"

    # LLM
    llm_provider: str = "yandexgpt"
    llm_max_tokens: int = 2000
    llm_temperature: float = 0.3

    # YandexGPT
    yandexgpt_api_key: str = ""
    yandexgpt_folder_id: str = ""
    yandexgpt_base_url: str = "https://llm.api.cloud.yandex.net/v1"
    yandexgpt_model: str = "yandexgpt-lite"

    # GigaChat
    gigachat_api_key: str = ""
    gigachat_model: str = "GigaChat"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Настройки агента
    agent_max_steps: int = 5
    agent_timeout_sec: int = 30

    # Приложение
    env: str = "development"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()