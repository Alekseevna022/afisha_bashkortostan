
"use client";

import { useEffect, useState } from "react";
import EventCard from "@/app/components/EventCard";
import { getToken, authFetch } from "@/app/lib/auth";
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

/* Пункты бокового меню: как в личном кабинете.
   На телефоне идут в строку с прокруткой, на md+ — столбиком. */
const navBase =
  "block shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-left text-sm transition-colors md:border-b-0 md:border-l-2";
const navOn = "border-accent bg-white font-semibold text-primary";
const navOff =
  "border-transparent text-muted hover:border-stone-400 hover:text-primary";

const groupLabel = "mb-2 text-xs tracking-widest text-muted";
const fieldClass =
  "w-full border border-stone-300 bg-white px-3 py-2 text-sm transition-colors focus:border-accent focus:outline-none";
const actionButtonClass =
  "mt-4 border border-stone-300 bg-white px-6 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

export default function EventList() {
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [isFree, setIsFree] = useState(false);
  // "", "today", "tomorrow", "weekend" или дата вида "2026-11-20"
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0); // увеличиваем, чтобы повторить неудачный запрос
  const [result, setResult] = useState<LoadResult | null>(null);

  // ID событий, добавленных пользователем в избранное
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const requestKey = `${city}|${category}|${isFree}|${dateFilter}|${page}|${retry}`;
  const loading = result?.key !== requestKey;
  const customDate = CUSTOM_DATE_RE.test(dateFilter) ? dateFilter : "";
  const hasFilters = Boolean(city || category || isFree || dateFilter);

  // Загружаем избранное авторизованного пользователя
  useEffect(() => {
    if (!getToken()) {
      setFavoriteIds([]);
      return;
    }

    let cancelled = false;

    authFetch("/api/v1/favorites/ids")
      .then(async (res) => {
        if (res.status === 401) {
          setFavoriteIds([]);
          return null;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;

        setFavoriteIds(data.items ?? []);
      })
      .catch((err) => {
        console.error("Не удалось загрузить избранное:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Обновляем локальное состояние после изменения избранного в карточке
  function handleFavoriteChange(eventId: string, value: boolean) {
    setFavoriteIds((prev) => {
      if (value) {
        return prev.includes(eventId) ? prev : [...prev, eventId];
      }

      return prev.filter((id) => id !== eventId);
    });
  }

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
    <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
      {/* ───────── Боковая панель с фильтрами ───────── */}
      <aside className="space-y-7 md:sticky md:top-8 md:self-start">
        {/* Даты */}
        <div>
          <p className={groupLabel}>КОГДА</p>
          <nav className="flex overflow-x-auto md:block md:space-y-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={dateFilter === p.value}
                onClick={() => {
                  setDateFilter(p.value);
                  setPage(1);
                }}
                className={`${navBase} ${dateFilter === p.value ? navOn : navOff}`}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <input
            type="date"
            aria-label="Выбрать дату"
            value={customDate}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className={`${fieldClass} mt-3 cursor-pointer ${
              customDate ? "border-accent" : ""
            }`}
          />
        </div>

        {/* Категории */}
        <div className="border-t border-stone-200 pt-6">
          <p className={groupLabel}>КАТЕГОРИЯ</p>
          <nav className="flex overflow-x-auto md:block md:space-y-1">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={category === c.value}
                onClick={() => {
                  setCategory(c.value);
                  setPage(1);
                }}
                className={`${navBase} ${category === c.value ? navOn : navOff}`}
              >
                <span aria-hidden>{c.emoji}</span> {c.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Город и бесплатные */}
        <div className="space-y-4 border-t border-stone-200 pt-6">
          <div>
            <p className={groupLabel}>ГОРОД</p>
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
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
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
        </div>

        {hasFilters && (
          <div className="border-t border-stone-200 pt-5">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-muted transition-colors hover:text-red-700"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </aside>

      {/* ───────── Содержимое ───────── */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-5">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-primary">
              Ближайшие события
            </h2>
            <p className="mt-1 text-sm text-muted">
              Подберите событие по дате, категории и городу
            </p>
          </div>

          {events.length > 0 && (
            <span className="border border-stone-300 px-3 py-1.5 text-xs text-muted">
              Найдено: {total}
            </span>
          )}
        </div>

        <div className="pt-8">
          {initialLoading ? (
            <div className="py-12 text-sm text-muted">Загружаем события...</div>
          ) : result?.error && events.length === 0 ? (
            <div className="border border-red-200 bg-white p-6 sm:p-8">
              <p className="font-serif text-2xl font-semibold text-primary">
                Не удалось загрузить события
              </p>
              <p className="mt-2 text-sm text-muted">
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
            <div className="border border-stone-200 bg-white p-6 sm:p-8">
              <p className="font-serif text-2xl font-semibold text-primary">
                По вашему запросу ничего не найдено
              </p>
              <p className="mt-2 text-sm text-muted">
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
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isFavorite={favoriteIds.includes(event.id)}
                    onFavoriteChange={handleFavoriteChange}
                  />
                ))}
              </div>

              {result?.error && !loading ? (
                <div className="mt-10 border-t border-stone-200 pt-6 text-center">
                  <p className="mb-3 text-sm text-muted">
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
                  <div className="mt-10 border-t border-stone-200 pt-6 text-center">
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
      </div>
    </div>
  );
}
