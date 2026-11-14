from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)


def get_main_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="Концерты"),
                KeyboardButton(text="Спектакли"),
            ],
            [
                KeyboardButton(text="Выставки"),
                KeyboardButton(text="Фестивали"),
            ],
            [
                KeyboardButton(text="Кино"),
                KeyboardButton(text="Экскурсии"),
            ],
            [
                KeyboardButton(text="Главное меню"),
            ],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        input_field_placeholder="Выберите категорию или напишите запрос",
    )


def get_website_keyboard(site_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Перейти на сайт",
                    url=site_url,
                )
            ]
        ]
    )


def get_event_keyboard(event_url: str, site_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть мероприятие",
                    url=event_url,
                )
            ],
            [
                InlineKeyboardButton(
                    text="Перейти на сайт",
                    url=site_url,
                )
            ],
        ]
    )


def get_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Главное меню",
                    callback_data="back",
                )
            ]
        ]
    )