"""Главный файл Telegram-бота."""
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from app.config import get_settings
from app.bot.handlers import start, chat, categories

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    settings = get_settings()
    
    if not settings.telegram_bot_token:
        logger.error("TELEGRAM_BOT_TOKEN не установлен в .env")
        return
    
    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher(storage=MemoryStorage())
    
    # Регистрируем обработчики
    dp.include_router(start.router)
    dp.include_router(categories.router)
    dp.include_router(chat.router)
    
    logger.info("🤖 Бот запущен")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())