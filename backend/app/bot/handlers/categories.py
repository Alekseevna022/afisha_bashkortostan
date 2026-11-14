from aiogram import Router, F
from aiogram.types import CallbackQuery
from aiogram.fsm.context import FSMContext

from app.bot.keyboards import get_main_keyboard

router = Router()


@router.callback_query(F.data == "back")
async def back_to_main(
    callback: CallbackQuery,
    state: FSMContext,
):
    await state.clear()

    await callback.message.answer(
        "Вы вернулись в главное меню.",
        reply_markup=get_main_keyboard(),
    )

    await callback.answer()