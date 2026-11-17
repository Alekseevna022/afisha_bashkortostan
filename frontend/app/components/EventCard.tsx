
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/app/lib/auth";
import {
  categoryLabel,
  categoryStyle,
  formatPlace,
  formatPriceFrom,
  type AfishaEvent,
} from "@/app/lib/events";

type Props = {
  event: AfishaEvent;
  isFavorite: boolean;
  onFavoriteChange: (eventId: string, value: boolean) => void;
};

export default function EventCard({
  event,
  isFavorite,
  onFavoriteChange,
}: Props) {
  const style = categoryStyle(event.category);
  const date = new Date(event.date_start);
  const router = useRouter();

  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const day = date.getDate();
  const month = date
    .toLocaleDateString("ru-RU", { month: "short" })
    .replace(".", "");
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "short" });

  // Для выставок и т.п. время часто 00:00 — тогда его не показываем
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handleFavoriteClick() {
    if (favoriteLoading) return;

    setFavoriteLoading(true);

    try {
      const response = await authFetch(
        `/api/v1/favorites/${event.id}`,
        {
          method: isFavorite ? "DELETE" : "POST",
        }
      );

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      onFavoriteChange(event.id, !isFavorite);
    } catch (error) {
      console.error("Не удалось изменить избранное:", error);
    } finally {
      setFavoriteLoading(false);
    }
  }

  return (
    <div className="group relative flex flex-col border border-stone-200 bg-white transition-colors hover:border-accent">
      <Link
        href={`/events/${event.id}`}
        className="flex flex-1 flex-col"
      >
        {/* «Обложка» */}
        <div
          className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${style.gradient}`}
        >
          <span className="text-5xl opacity-90" aria-hidden>
            {style.emoji}
          </span>

          <div className="absolute left-0 top-0 border-b border-r border-stone-200 bg-white px-3 py-2 text-center leading-none">
            <div className="text-xl font-semibold text-primary">{day}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {month}
            </div>
          </div>

          <span className="absolute right-3 top-12 border border-stone-300 bg-white/90 px-2 py-1 text-xs text-muted">
            {event.age_limit}+
          </span>
        </div>

        {/* Содержимое */}
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            {categoryLabel(event.category)}
          </div>

          <h2 className="mb-3 line-clamp-2 font-serif text-xl font-semibold leading-tight text-primary transition-colors group-hover:text-accent">
            {event.title}
          </h2>

          <p className="mb-1 text-sm text-muted">
            {weekday}
            {hasTime ? `, ${time}` : ""}
          </p>

          <p className="mb-3 line-clamp-1 text-sm text-muted">
            {formatPlace(event)}
          </p>

          <p className="mb-5 line-clamp-2 text-sm leading-6 text-muted">
            {event.description || "Описание отсутствует"}
          </p>

          <div className="mt-auto flex items-center justify-between border-t border-stone-200 pt-4">
            <span className="text-sm font-semibold text-primary">
              {formatPriceFrom(event)}
            </span>

            <span className="text-sm text-muted transition-colors group-hover:text-accent">
              Подробнее →
            </span>
          </div>
        </div>
      </Link>

      {/* Кнопка избранного */}
      <button
        type="button"
        onClick={handleFavoriteClick}
        disabled={favoriteLoading}
        aria-label={
          isFavorite
            ? "Убрать из избранного"
            : "Добавить в избранное"
        }
        aria-pressed={isFavorite}
        title={
          isFavorite
            ? "Убрать из избранного"
            : "Добавить в избранное"
        }
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center border border-stone-300 bg-white/95 text-xl transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <span className={isFavorite ? "text-red-600" : "text-muted"}>
          {isFavorite ? "♥" : "♡"}
        </span>
      </button>
    </div>
  );
}
