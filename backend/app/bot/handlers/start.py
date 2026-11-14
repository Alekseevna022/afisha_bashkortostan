from aiogram import Router
from aiogram.types import Message
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext

from app.bot.keyboards import get_main_keyboard

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()

    await message.answer(
        "Афиша Башкортостана\n\n"
        "Здесь можно найти концерты, спектакли, выставки "
        "и другие мероприятия республики.\n\n"
        "Выберите категорию или напишите, что вас интересует.",
        reply_markup=get_main_keyboard(),
    )