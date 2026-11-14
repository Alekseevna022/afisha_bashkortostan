import Link from "next/link";
import {
  categoryLabel,
  categoryStyle,
  formatPlace,
  formatPriceFrom,
  type AfishaEvent,
} from "@/app/lib/events";

export default function EventCard({ event }: { event: AfishaEvent }) {
  const style = categoryStyle(event.category);
  const date = new Date(event.date_start);

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

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-stone-200 bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg"
    >
      {/* «Обложка» */}
      <div
        className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${style.gradient}`}
      >
        <span className="text-5xl opacity-90" aria-hidden>
          {style.emoji}
        </span>

        <div className="absolute left-4 top-4 rounded-xl bg-surface px-3 py-1.5 text-center leading-none shadow-sm">
          <div className="font-sans text-xl font-bold">{day}</div>
          <div className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-wider text-muted">
            {month}
          </div>
        </div>

        <span className="absolute right-4 top-4 rounded-full bg-surface/90 px-2.5 py-1 font-sans text-xs font-semibold text-muted">
          {event.age_limit}+
        </span>
      </div>

      {/* Содержимое */}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-accent">
          {categoryLabel(event.category)}
        </div>

        <h2 className="mb-3 line-clamp-2 font-serif text-2xl font-bold leading-tight transition-colors group-hover:text-accent">
          {event.title}
        </h2>

        <p className="mb-1 font-sans text-sm text-muted">
          {weekday}
          {hasTime ? `, ${time}` : ""}
        </p>
        <p className="mb-3 line-clamp-1 font-sans text-sm text-muted">
          {formatPlace(event)}
        </p>

        <p className="mb-4 line-clamp-2 font-sans text-sm leading-relaxed text-primary/80">
          {event.description || "Описание отсутствует"}
        </p>

        <div className="mt-auto border-t border-stone-100 pt-4">
          <span className="font-sans text-sm font-semibold text-accent">
            {formatPriceFrom(event)}
          </span>
        </div>
      </div>
    </Link>
  );
}