"""Извлечение контекста из истории диалога."""

def extract_context_from_history(history: list[dict]) -> dict:
    """Извлекает параметры из истории диалога."""
    context = {
        "city": None,
        "category": None,
        "is_free": None,
    }
    
    cities = ["Уфа", "Стерлитамак", "Салават", "Нефтекамск", "Октябрьский", 
              "Белебей", "Благовещенск", "Давлеканово", "Дюртюли", "Ишимбай", 
              "Кумертау", "Мелеуз", "Сибай", "Туймазы", "Бирск", "Янаул"]
    category_map = {
        "концерт": "concert",
        "концерты": "concert",
        "спектакль": "play",
        "спектакли": "play",
        "выставка": "exhibition",
        "выставки": "exhibition",
        "фестиваль": "festival",
        "фестивали": "festival",
        "кино": "cinema",
        "экскурсия": "tour",
        "экскурсии": "tour",
    }
    
    for msg in history:
        if not isinstance(msg, dict):
            continue
        if "role" not in msg or "content" not in msg:
            continue
            
        if msg["role"] == "user":
            text = msg["content"].lower()
            
            # Ищем город
            for city in cities:
                if city.lower() in text:
                    context["city"] = city
            
            # Ищем категорию
            for cat_ru, cat_en in category_map.items():
                if cat_ru in text:
                    context["category"] = cat_en
            
            # Ищем "бесплатно"
            if "бесплатно" in text or "бесплатные" in text or "бесплатный" in text:
                context["is_free"] = True
            elif "платно" in text or "платные" in text:
                context["is_free"] = False
    
    return context