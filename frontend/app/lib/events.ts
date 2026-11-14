/** Базовый URL API. Переопределяется через NEXT_PUBLIC_API_URL. */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export type EventStatus = "published" | "draft" | "cancelled";

/** Совпадает со схемой EventResponse на бэкенде (backend/app/schemas/events.py). */
export interface AfishaEvent {
  id: string;
  title: string;
  category: string;
  date_start: string;
  city: string;
  venue: string | null;
  address: string | null;
  description: string | null;
  price_min: number;
  price_max: number;
  is_free: boolean;
  age_limit: number;
  status: EventStatus;
  org_link: string | null;
  source_url: string | null;
}

export interface EventListResponse {
  items: AfishaEvent[];
  total: number;
  page: number;
  per_page: number;
}

/* ───────────── Категории ───────────── */

export const CATEGORY_LABELS: Record<string, string> = {
  concert: "Концерт",
  play: "Спектакль",
  exhibition: "Выставка",
  festival: "Фестиваль",
  cinema: "Кино",
  tour: "Экскурсия",
  other: "Другое",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Кнопки-фильтры категорий над списком. */
export const CATEGORY_FILTERS = [
  { value: "", label: "Все", emoji: "✨" },
  { value: "concert", label: "Концерты", emoji: "🎵" },
  { value: "play", label: "Спектакли", emoji: "🎭" },
  { value: "exhibition", label: "Выставки", emoji: "🖼️" },
  { value: "festival", label: "Фестивали", emoji: "🎪" },
  { value: "cinema", label: "Кино", emoji: "🎬" },
  { value: "tour", label: "Экскурсии", emoji: "🗺️" },
  { value: "other", label: "Другое", emoji: "📌" },
];

/**
 * Оформление «обложки» карточки по категории.
 * Классы записаны целиком, иначе Tailwind их не найдёт.
 */
const CATEGORY_STYLES: Record<string, { gradient: string; emoji: string }> = {
  concert: { gradient: "from-amber-200 to-orange-300", emoji: "🎵" },
  play: { gradient: "from-rose-200 to-red-300", emoji: "🎭" },
  exhibition: { gradient: "from-sky-200 to-indigo-300", emoji: "🖼️" },
  festival: { gradient: "from-fuchsia-200 to-pink-300", emoji: "🎪" },
  cinema: { gradient: "from-slate-300 to-zinc-400", emoji: "🎬" },
  tour: { gradient: "from-emerald-200 to-teal-300", emoji: "🗺️" },
  other: { gradient: "from-stone-200 to-stone-300", emoji: "📌" },
};

export function categoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other;
}

/* ───────────── Города ───────────── */

/** Тот же список, что в backend/app/agent/context.py. */
export const CITIES = [
  "Уфа",
  "Стерлитамак",
  "Салават",
  "Нефтекамск",
  "Октябрьский",
  "Белебей",
  "Благовещенск",
  "Давлеканово",
  "Дюртюли",
  "Ишимбай",
  "Кумертау",
  "Мелеуз",
  "Сибай",
  "Туймазы",
  "Бирск",
  "Янаул",
];

/* ───────────── Даты ───────────── */

export const DATE_PRESETS = [
  { value: "", label: "Все даты" },
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
  { value: "weekend", label: "Выходные" },
];

export const CUSTOM_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Превращает значение фильтра ("", "today", "tomorrow", "weekend" или
 * "YYYY-MM-DD") в диапазон date_from / date_to для API.
 * Вызывать только на клиенте (в эффекте или обработчике), не при рендере.
 */
export function getDateRange(
  filter: string,
): { from: string; to: string } | null {
  if (!filter) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = today;
  let to = today;

  if (filter === "tomorrow") {
    from = to = addDays(today, 1);
  } else if (filter === "weekend") {
    const dow = today.getDay(); // 0 — воскресенье, 6 — суббота
    if (dow === 6) {
      to = addDays(today, 1);
    } else if (dow !== 0) {
      from = addDays(today, 6 - dow);
      to = addDays(from, 1);
    }
  } else if (CUSTOM_DATE_RE.test(filter)) {
    const [y, m, d] = filter.split("-").map(Number);
    from = to = new Date(y, m - 1, d);
  } // "today" — значения по умолчанию

  return {
    from: `${isoDate(from)}T00:00:00`,
    to: `${isoDate(to)}T23:59:59`,
  };
}

/* ───────────── Форматирование ───────────── */

/** Полная цена (страница события). */
export function formatPrice(event: AfishaEvent): string {
  if (event.is_free) return "Бесплатно";
  const { price_min: min, price_max: max } = event;
  if (!min && !max) return "Цена не указана";
  if (min === max || !max) return `${min} ₽`;
  return `${min}–${max} ₽`;
}

/** Короткая цена для карточки: «от 500 ₽». */
export function formatPriceFrom(event: AfishaEvent): string {
  if (event.is_free) return "Бесплатно";
  const { price_min: min, price_max: max } = event;
  if (!min && !max) return "Цена не указана";
  if (min === max) return `${min} ₽`;
  if (!min) return `до ${max} ₽`;
  return `от ${min} ₽`;
}

export function formatPlace(event: AfishaEvent): string {
  return [event.city, event.venue].filter(Boolean).join(", ");
}