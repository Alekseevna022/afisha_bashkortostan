"use client";

import { useEffect, useState } from "react";
import EventCard from "@/app/components/EventCard";
import {
  API_URL,
  CATEGORY_FILTERS,
  CITIES,
  CUSTOM_DATE_RE,
  DATE_PRESETS,
  getDateRange,
  type AfishaEvent,
  type EventListResponse,
} from "@/app/lib/events";

const PER_PAGE = 12;

interface LoadResult {
  /** Ключ запроса, на который получен этот результат */
  key: string;
  items: AfishaEvent[];
  total: number;
  error: boolean;
}

const chipBase =
  "shrink-0 rounded-button border px-4 py-1.5 font-sans text-sm transition-colors";
const chipOff =
  "border-stone-300 bg-surface text-primary hover:border-accent hover:text-accent";
const chipOn = "border-accent bg-accent font-semibold text-white";
const fieldClass =
  "rounded-lg border border-stone-300 bg-background px-4 py-2 font-sans text-sm transition-colors focus:border-accent focus:outline-none";
const actionButtonClass =
  "mt-4 rounded-button border border-stone-300 bg-surface px-6 py-2 font-sans text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

export default function EventList() {
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [isFree, setIsFree] = useState(false);
  // "", "today", "tomorrow", "weekend" или дата вида "2026-11-20"
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0); // увеличиваем, чтобы повторить неудачный запрос
  const [result, setResult] = useState<LoadResult | null>(null);

  const requestKey = `${city}|${category}|${isFree}|${dateFilter}|${page}|${retry}`;
  const loading = result?.key !== requestKey;
  const customDate = CUSTOM_DATE_RE.test(dateFilter) ? dateFilter : "";
  const hasFilters = Boolean(city || category || isFree || dateFilter);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(PER_PAGE),
    });
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (isFree) params.set("is_free", "true");

    // Даты считаем здесь (только на клиенте), чтобы не было расхождений при SSR
    const range = getDateRange(dateFilter);
    if (range) {
      params.set("date_from", range.from);
      params.set("date_to", range.to);
    }

    fetch(`${API_URL}/api/v1/events?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<EventListResponse>;
      })
      .then((data) => {
        setResult((prev) => ({
          key: requestKey,
          items: page === 1 || !prev ? data.items : [...prev.items, ...data.items],
          total: data.total,
          error: false,
        }));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setResult((prev) => ({
          key: requestKey,
          items: page === 1 ? [] : (prev?.items ?? []),
          total: page === 1 ? 0 : (prev?.total ?? 0),
          error: true,
        }));
      });

    // Отменяем устаревший запрос, чтобы он не перезаписал свежий результат
    return () => controller.abort();
  }, [city, category, isFree, dateFilter, page, requestKey]);

  const events = result?.items ?? [];
  const total = result?.total ?? 0;
  const initialLoading = loading && page === 1;
  const hasMore = !loading && !result?.error && events.length < total;

  function resetFilters() {
    setCity("");
    setCategory("");
    setIsFree(false);
    setDateFilter("");
    setPage(1);
  }

  return (
    <div>
      {/* Фильтры */}
      <div className="mb-8 space-y-4 rounded-card border border-stone-200 bg-surface p-5 shadow-sm sm:p-6">
        {/* Даты */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={dateFilter === p.value}
              onClick={() => {
                setDateFilter(p.value);
                setPage(1);
              }}
              className={`${chipBase} ${dateFilter === p.value ? chipOn : chipOff}`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            aria-label="Выбрать дату"
            value={customDate}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className={`${chipBase} cursor-pointer ${customDate ? chipOn : chipOff}`}
          />
        </div>

        {/* Категории */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={category === c.value}
              onClick={() => {
                setCategory(c.value);
                setPage(1);
              }}
              className={`${chipBase} ${category === c.value ? chipOn : chipOff}`}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        {/* Город, бесплатные, сброс */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-stone-100 pt-4">
          <select
            aria-label="Город"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            className={fieldClass}
          >
            <option value="">Вся республика</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 font-sans text-sm">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => {
                setIsFree(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 accent-accent"
            />
            Только бесплатные
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-sans text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline sm:ml-auto"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      {initialLoading ? (
        <div className="py-12 text-center font-serif text-xl text-muted">
          Загрузка событий...
        </div>
      ) : result?.error && events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-serif text-2xl italic text-muted">
            Не удалось загрузить события
          </p>
          <p className="mt-2 font-sans text-sm text-muted">
            Проверьте, что API запущено ({API_URL})
          </p>
          <button
            type="button"
            onClick={() => setRetry((r) => r + 1)}
            className={actionButtonClass}
          >
            Повторить
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-serif text-2xl italic text-muted">
            По вашему запросу ничего не найдено
          </p>
          <p className="mt-2 font-sans text-sm text-muted">
            Попробуйте изменить фильтры
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={actionButtonClass}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 font-sans text-sm text-muted">
            Найдено: {total}
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {result?.error && !loading ? (
            <div className="mt-8 text-center">
              <p className="mb-3 font-sans text-sm text-muted">
                Не удалось загрузить следующую страницу
              </p>
              <button
                type="button"
                onClick={() => setRetry((r) => r + 1)}
                className={actionButtonClass}
              >
                Повторить
              </button>
            </div>
          ) : (
            (hasMore || (loading && page > 1)) && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPage((p) => p + 1)}
                  className={actionButtonClass}
                >
                  {loading ? "Загрузка..." : "Показать ещё"}
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}