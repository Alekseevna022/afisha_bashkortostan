import logging
import re

from aiogram import Router, F
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

from app.agent.service import AgentService
from app.bot.keyboards import (
    get_main_keyboard,
    get_website_keyboard,
    get_event_keyboard,
)
from app.config import get_settings

router = Router()
logger = logging.getLogger(__name__)


CATEGORIES = {
    "Концерты": ("concert", "концерты"),
    "Спектакли": ("play", "спектакли"),
    "Выставки": ("exhibition", "выставки"),
    "Фестивали": ("festival", "фестивали"),
    "Кино": ("cinema", "кино"),
    "Экскурсии": ("tour", "экскурсии"),
}

UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-"
    r"[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)


@router.message(F.text)
async def handle_message(message: Message, state: FSMContext):
    user_message = message.text.strip()

    if not user_message:
        return

    # Главное меню
    if user_message.lower() in ("главное меню", "/menu"):
        await state.clear()

        await message.answer(
            "Выберите категорию или напишите свой запрос.",
            reply_markup=get_main_keyboard(),
        )
        return

    # Выбор категории
    if user_message in CATEGORIES:
        category_code, category_name = CATEGORIES[user_message]

        await state.update_data(
            category=category_code,
            category_name=category_name,
        )

        await message.answer(
            f"Выбрана категория: {category_name}.\n\n"
            "Укажите город, дату или другие пожелания.",
            reply_markup=get_main_keyboard(),
        )
        return

    # Получаем сохранённую категорию
    user_data = await state.get_data()
    selected_category = user_data.get("category_name")

    # Формируем запрос агенту
    if selected_category:
        agent_message = (
            f"Подбери мероприятия категории «{selected_category}». "
            f"Пожелания пользователя: {user_message}"
        )
    else:
        agent_message = user_message

    await message.bot.send_chat_action(
        chat_id=message.chat.id,
        action="typing",
    )

    try:
        result = await AgentService.chat(
            user_message=agent_message,
            session_id=str(message.from_user.id),
            history=[],
        )

        reply_text = result.get(
            "reply",
            "Не удалось получить ответ. Попробуйте ещё раз.",
        )

        settings = get_settings()
        site_url = settings.site_url.rstrip("/")

        if "localhost" in site_url or "127.0.0.1" in site_url:
            site_url = "https://example.com"

        # Ищем ID мероприятия в ответе агента
        event_ids = [
            event.get("id")
            for event in result.get("events", [])
            if event.get("id")
        ]

        if not event_ids:
            event_ids = UUID_PATTERN.findall(reply_text)

        # Формируем клавиатуру
        if event_ids:
            event_url = f"{site_url}/events/{event_ids[0]}"

            keyboard = get_event_keyboard(
                event_url=event_url,
                site_url=site_url,
            )
        else:
            keyboard = get_website_keyboard(site_url)

        # Отправляем ответ частями, если он длинный
        max_length = 4000

        if len(reply_text) <= max_length:
            await message.answer(
                reply_text,
                reply_markup=keyboard,
                parse_mode="Markdown",
            )
        else:
            parts = [
                reply_text[i:i + max_length]
                for i in range(0, len(reply_text), max_length)
            ]

            for index, part in enumerate(parts):
                await message.answer(
                    part,
                    reply_markup=(
                        keyboard
                        if index == len(parts) - 1
                        else None
                    ),
                    parse_mode="Markdown",
                )

    except Exception:
        logger.exception("Ошибка обработки сообщения Telegram")

        await message.answer(
            "Не удалось обработать запрос. "
            "Попробуйте ещё раз немного позже."
        )