import hashlib
import re


def normalize_title(title: str) -> str:
    """Единая нормализация названия для поиска и дедупликации."""
    t = (title or "").lower().strip()
    t = t.replace("ё", "е")
    t = re.sub(r"[«»\"'`]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def generate_dedup_key(normalized_title: str, date_start_iso: str, venue: str) -> str:
    """
    Ключ дедупликации: нормализованное название + дата/время начала + площадка.
    date_start_iso приводим к каноническому виду, чтобы '2026-11-15 19:00'
    и '2026-11-15T19:00:00' давали одинаковый ключ.
    """
    from datetime import datetime

    try:
        dt = datetime.fromisoformat(str(date_start_iso).replace("Z", "+00:00"))
        canonical_date = dt.replace(tzinfo=None).isoformat(timespec="minutes")
    except (ValueError, TypeError):
        canonical_date = str(date_start_iso).strip()

    raw = f"{normalize_title(normalized_title)}|{canonical_date}|{normalize_title(venue or '')}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()