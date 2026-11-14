"""Защита от инъекций промптов."""
import re
from typing import Optional


# Паттерны явных попыток инъекции (только самые очевидные)
INJECTION_PATTERNS = [
    r"игнорируй\s+(все\s+)?(предыдущие\s+)?инструкции",
    r"забудь\s+(все\s+)?(предыдущие\s+)?(инструкции|правила)",
    r"покажи\s+(системный\s+)?промпт",
    r"раскрой\s+(системный\s+)?промпт",
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"forget\s+(all\s+)?(previous\s+)?(instructions|rules)",
    r"ты\s+теперь\s+(другой\s+)?(бот|ассистент|помощник)",
    r"act\s+as\s+(a\s+)?different\s+(bot|assistant)",
]


def check_injection(text: str) -> Optional[str]:
    """Проверяет текст на попытку инъекции."""
    text_lower = text.lower()
    
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return f"Обнаружена попытка инъекции: {pattern}"
    
    return None