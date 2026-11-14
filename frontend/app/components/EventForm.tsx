"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL, CATEGORY_FILTERS, CITIES } from "@/app/lib/events";

const CATEGORIES = CATEGORY_FILTERS.filter((c) => c.value);
const AGE_LIMITS = [0, 6, 12, 16, 18];
const OTHER_CITY = "__other";

type FieldName =
  | "title"
  | "category"
  | "date_start"
  | "date_end"
  | "city"
  | "venue"
  | "address"
  | "description"
  | "price_min"
  | "price_max"
  | "age_limit"
  | "org_link"
  | "language"
  | "tags"
  | "duration_min"
  | "lat"
  | "lon";

/** Порядок полей на форме: по нему ищем первое поле с ошибкой. */
const FIELD_ORDER: FieldName[] = [
  "title",
  "category",
  "date_start",
  "date_end",
  "city",
  "venue",
  "address",
  "description",
  "price_min",
  "price_max",
  "age_limit",
  "org_link",
  "language",
  "tags",
  "duration_min",
  "lat",
  "lon",
];

/** Поля из блока «Дополнительно» — если в них ошибка, блок раскрываем. */
const ADVANCED_FIELDS: FieldName[] = [
  "language",
  "tags",
  "duration_min",
  "lat",
  "lon",
];

type Errors = Partial<Record<FieldName, string>>;

interface FormState {
  title: string;
  category: string;
  date_start: string;
  date_end: string;
  city: string;
  venue: string;
  address: string;
  description: string;
  is_free: boolean;
  price_min: string;
  price_max: string;
  age_limit: string;
  org_link: string;
  language: string;
  tags: string;
  duration_min: string;
  lat: string;
  lon: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  category: "",
  date_start: "",
  date_end: "",
  city: "",
  venue: "",
  address: "",
  description: "",
  is_free: false,
  price_min: "",
  price_max: "",
  age_limit: "0",
  org_link: "",
  language: "",
  tags: "",
  duration_min: "",
  lat: "",
  lon: "",
};

interface FormError {
  text: string;
  /** Ссылка на уже существующее мероприятие (при дубле) */
  href?: string;
}

/** Форма ответа бэкенда при ошибках (FastAPI). */
interface ApiValidationItem {
  loc?: (string | number)[];
  msg?: string;
}
interface ApiErrorBody {
  detail?:
    | string
    | { message?: string; event_id?: string | null }
    | ApiValidationItem[];
}

/* ───────────── Проверка и сборка данных ───────────── */

const isNonNegInt = (s: string) => /^\d+$/.test(s.trim());

function validate(f: FormState, customCity: boolean): Errors {
  const e: Errors = {};

  if (!f.title.trim()) e.title = "Укажите название";
  if (!f.category) e.category = "Выберите категорию";
  if (!f.date_start) e.date_start = "Укажите дату и время начала";
  if (f.date_end && f.date_start && f.date_end < f.date_start) {
    e.date_end = "Окончание раньше начала";
  }
  if (!f.city.trim()) e.city = customCity ? "Введите город" : "Выберите город";

  if (!f.is_free) {
    if (f.price_min.trim() && !isNonNegInt(f.price_min)) {
      e.price_min = "Целое число от 0";
    }
    if (f.price_max.trim() && !isNonNegInt(f.price_max)) {
      e.price_max = "Целое число от 0";
    }
    if (!e.price_min && !e.price_max) {
      const min = Number(f.price_min || 0);
      const max = Number(f.price_max || 0);
      if (max > 0 && max < min) e.price_max = "Меньше минимальной цены";
    }
  }

  if (f.org_link.trim()) {
    try {
      const url = new URL(f.org_link.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      e.org_link = "Ссылка должна начинаться с http:// или https://";
    }
  }

  if (
    f.duration_min.trim() &&
    (!isNonNegInt(f.duration_min) || Number(f.duration_min) < 1)
  ) {
    e.duration_min = "Целое число минут, от 1";
  }
  if (f.tags.split(",").filter((t) => t.trim()).length > 20) {
    e.tags = "Не больше 20 тегов";
  }

  for (const [name, limit] of [
    ["lat", 90],
    ["lon", 180],
  ] as const) {
    const raw = f[name].trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || Math.abs(n) > limit) {
      e[name] = `Число от −${limit} до ${limit}`;
    }
  }

  return e;
}

function buildPayload(f: FormState) {
  const opt = (s: string) => s.trim() || null;
  const num = (s: string) => (s.trim() ? Number(s) : null);

  return {
    title: f.title.trim(),
    category: f.category,
    // datetime-local отдаёт «2026-11-20T19:00» — бэкенд принимает как есть
    date_start: f.date_start,
    date_end: opt(f.date_end),
    city: f.city.trim(),
    venue: opt(f.venue),
    address: opt(f.address),
    description: opt(f.description),
    is_free: f.is_free,
    price_min: f.is_free ? 0 : (num(f.price_min) ?? 0),
    price_max: f.is_free ? 0 : (num(f.price_max) ?? 0),
    age_limit: Number(f.age_limit),
    org_link: opt(f.org_link),
    language: opt(f.language),
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    duration_min: num(f.duration_min),
    lat: num(f.lat),
    lon: num(f.lon),
  };
}

/** «Value error, текст» -> «текст» */
const cleanServerMessage = (msg: string | undefined) =>
  (msg ?? "Некорректное значение").replace(/^Value error,\s*/, "");

/* ───────────── Оформление ───────────── */

const inputBase =
  "w-full rounded-lg border bg-background px-4 py-2 font-sans text-sm transition-colors focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const inputOk = "border-stone-300";
const inputBad = "border-red-400";

function Field({
  name,
  label,
  required,
  error,
  hint,
  children,
}: {
  name: FieldName;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={`field-${name}`}
        className="mb-1.5 block font-sans text-sm font-semibold"
      >
        {label}
        {required && (
          <span className="text-accent" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`hint-${name}`} className="mt-1 font-sans text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`error-${name}`}
          role="alert"
          className="mt-1 font-sans text-xs font-semibold text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* ───────────── Форма ───────────── */

export default function EventForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [customCity, setCustomCity] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Как только человек правит поле, его ошибку убираем
    if (key in errors) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  /** Показывает ошибки и переводит фокус на первое проблемное поле. */
  function showErrors(next: Errors) {
    setErrors(next);
    const firstBad = FIELD_ORDER.find((name) => next[name]);
    if (!firstBad) return;
    if (ADVANCED_FIELDS.includes(firstBad)) setAdvancedOpen(true);
    // Блок «Дополнительно» раскрывается после рендера — фокусируем в следующем кадре
    requestAnimationFrame(() => {
      document.getElementById(`field-${firstBad}`)?.focus();
    });
  }

  async function handleErrorResponse(res: Response) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const detail = body?.detail;

    if (res.status === 409 && detail && typeof detail === "object" && !Array.isArray(detail)) {
      setFormError({
        text: detail.message ?? "Такое мероприятие уже есть",
        href: detail.event_id ? `/events/${detail.event_id}` : undefined,
      });
      return;
    }

    if (res.status === 422 && Array.isArray(detail)) {
      const fieldErrors: Errors = {};
      const general: string[] = [];
      for (const item of detail) {
        const field = item.loc?.[1];
        const msg = cleanServerMessage(item.msg);
        if (typeof field === "string" && FIELD_ORDER.includes(field as FieldName)) {
          fieldErrors[field as FieldName] ??= msg;
        } else {
          general.push(msg);
        }
      }
      if (general.length) setFormError({ text: general.join(". ") });
      showErrors(fieldErrors);
      return;
    }

    setFormError({
      text:
        typeof detail === "string"
          ? detail
          : `Не удалось сохранить мероприятие (HTTP ${res.status})`,
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const found = validate(form, customCity);
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/admin/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });

      if (res.status === 201) {
        const created = (await res.json()) as { id: string };
        // Кнопка остаётся заблокированной до конца перехода
        router.push(`/events/${created.id}`);
        return;
      }
      await handleErrorResponse(res);
    } catch (err) {
      console.error(err);
      setFormError({
        text: `Не удалось связаться с API (${API_URL}). Проверьте, что сервер запущен.`,
      });
    }
    setSubmitting(false);
  }

  /** Общие атрибуты поля: подсветка ошибки и связь с подсказкой для скринридеров. */
  function a11y(name: FieldName, hasHint = false) {
    return {
      id: `field-${name}`,
      "aria-invalid": errors[name] ? (true as const) : undefined,
      "aria-describedby": errors[name]
        ? `error-${name}`
        : hasHint
          ? `hint-${name}`
          : undefined,
      className: `${inputBase} ${errors[name] ? inputBad : inputOk}`,
    };
  }

  const citySelectValue = customCity ? OTHER_CITY : form.city;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-card border border-stone-200 bg-surface p-6 shadow-sm sm:p-8"
    >
      <h2 className="font-serif text-2xl font-bold">Данные мероприятия</h2>

      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
        >
          <p className="font-semibold">{formError.text}</p>
          {formError.href && (
            <Link href={formError.href} className="mt-1 inline-block underline">
              Открыть существующее мероприятие
            </Link>
          )}
        </div>
      )}

      <Field name="title" label="Название" required error={errors.title}>
        <input
          {...a11y("title")}
          type="text"
          maxLength={300}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Например: Вечер органной музыки"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="category" label="Категория" required error={errors.category}>
          <select
            {...a11y("category")}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Выберите…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field name="age_limit" label="Возрастное ограничение" error={errors.age_limit}>
          <select
            {...a11y("age_limit")}
            value={form.age_limit}
            onChange={(e) => set("age_limit", e.target.value)}
          >
            {AGE_LIMITS.map((age) => (
              <option key={age} value={age}>
                {age === 0 ? "0+ (для всех)" : `${age}+`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="date_start" label="Начало" required error={errors.date_start}>
          <input
            {...a11y("date_start")}
            type="datetime-local"
            value={form.date_start}
            onChange={(e) => set("date_start", e.target.value)}
          />
        </Field>

        <Field
          name="date_end"
          label="Окончание"
          error={errors.date_end}
          hint="Для выставок и фестивалей, которые идут несколько дней"
        >
          <input
            {...a11y("date_end", true)}
            type="datetime-local"
            value={form.date_end}
            onChange={(e) => set("date_end", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="city" label="Город" required error={errors.city}>
          <select
            {...a11y("city")}
            // В режиме «Другой город» id и фокус при ошибке достаются текстовому полю
            id={customCity ? undefined : "field-city"}
            value={citySelectValue}
            onChange={(e) => {
              if (e.target.value === OTHER_CITY) {
                setCustomCity(true);
                set("city", "");
              } else {
                setCustomCity(false);
                set("city", e.target.value);
              }
            }}
          >
            <option value="">Выберите…</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={OTHER_CITY}>Другой город…</option>
          </select>
          {customCity && (
            <input
              id="field-city"
              type="text"
              aria-label="Название города"
              aria-invalid={errors.city ? true : undefined}
              aria-describedby={errors.city ? "error-city" : undefined}
              maxLength={100}
              autoFocus
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Введите город"
              className={`${inputBase} mt-2 ${errors.city ? inputBad : inputOk}`}
            />
          )}
        </Field>

        <Field name="venue" label="Площадка" error={errors.venue}>
          <input
            {...a11y("venue")}
            type="text"
            maxLength={300}
            value={form.venue}
            onChange={(e) => set("venue", e.target.value)}
            placeholder="Например: Башкирская филармония"
          />
        </Field>
      </div>

      <Field name="address" label="Адрес" error={errors.address}>
        <input
          {...a11y("address")}
          type="text"
          maxLength={300}
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="ул. Ленина, 62"
        />
      </Field>

      <Field name="description" label="Описание" error={errors.description}>
        <textarea
          {...a11y("description")}
          rows={5}
          maxLength={5000}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      {/* Цена */}
      <fieldset className="space-y-4">
        <legend className="mb-1.5 font-sans text-sm font-semibold">Цена, ₽</legend>

        <label className="flex cursor-pointer items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            checked={form.is_free}
            onChange={(e) => set("is_free", e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Бесплатно
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="price_min" label="От" error={errors.price_min}>
            <input
              {...a11y("price_min")}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              disabled={form.is_free}
              value={form.is_free ? "" : form.price_min}
              onChange={(e) => set("price_min", e.target.value)}
              placeholder="500"
            />
          </Field>
          <Field name="price_max" label="До" error={errors.price_max}>
            <input
              {...a11y("price_max")}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              disabled={form.is_free}
              value={form.is_free ? "" : form.price_max}
              onChange={(e) => set("price_max", e.target.value)}
              placeholder="1500"
            />
          </Field>
        </div>
      </fieldset>

      <Field
        name="org_link"
        label="Сайт организатора"
        error={errors.org_link}
      >
        <input
          {...a11y("org_link")}
          type="url"
          maxLength={500}
          value={form.org_link}
          onChange={(e) => set("org_link", e.target.value)}
          placeholder="https://"
        />
      </Field>

      {/* Дополнительно */}
      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        className="rounded-lg border border-stone-200 px-4 py-3"
      >
        <summary className="cursor-pointer font-sans text-sm font-semibold">
          Дополнительно
        </summary>

        <div className="mt-4 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field name="language" label="Язык" error={errors.language}>
              <input
                {...a11y("language")}
                type="text"
                maxLength={50}
                value={form.language}
                onChange={(e) => set("language", e.target.value)}
                placeholder="Русский, башкирский…"
              />
            </Field>
            <Field
              name="duration_min"
              label="Длительность, мин"
              error={errors.duration_min}
            >
              <input
                {...a11y("duration_min")}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.duration_min}
                onChange={(e) => set("duration_min", e.target.value)}
                placeholder="90"
              />
            </Field>
          </div>

          <Field
            name="tags"
            label="Теги"
            error={errors.tags}
            hint="Через запятую: джаз, семейный, на открытом воздухе"
          >
            <input
              {...a11y("tags", true)}
              type="text"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field name="lat" label="Широта" error={errors.lat}>
              <input
                {...a11y("lat")}
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => set("lat", e.target.value)}
                placeholder="54.7388"
              />
            </Field>
            <Field name="lon" label="Долгота" error={errors.lon}>
              <input
                {...a11y("lon")}
                type="number"
                step="any"
                value={form.lon}
                onChange={(e) => set("lon", e.target.value)}
                placeholder="55.9721"
              />
            </Field>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-4 border-t border-stone-100 pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-button bg-accent px-8 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Сохраняем…" : "Добавить мероприятие"}
        </button>
        <Link
          href="/"
          className="font-sans text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}