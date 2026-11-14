import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  API_URL,
  categoryLabel,
  formatPlace,
  formatPrice,
  type AfishaEvent,
} from "@/app/lib/events";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getEvent(id: string): Promise<AfishaEvent> {
  // Бэкенд ждёт UUID; для мусора в URL отвечаем 404, а не 500
  if (!UUID_RE.test(id)) notFound();

  const res = await fetch(`${API_URL}/api/v1/events/${id}`, {
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Не удалось загрузить событие (HTTP ${res.status})`);

  return res.json();
}

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  const cancelled = event.status === "cancelled";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-accent">
        {categoryLabel(event.category)}
      </div>
      <h1 className="mb-4 font-serif text-4xl font-bold">{event.title}</h1>

      {cancelled && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm font-semibold text-red-800"
        >
          Мероприятие отменено
        </div>
      )}

      <div className="mb-6 rounded-card border border-stone-200 bg-surface p-6 shadow-sm">
        <p className="mb-2 font-sans text-muted">
          <span aria-hidden>📅 </span>
          {new Date(event.date_start).toLocaleString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mb-2 font-sans text-muted">
          <span aria-hidden>📍 </span>
          {formatPlace(event)}
          {event.address ? ` • ${event.address}` : ""}
        </p>
        <p className="mb-4 font-sans text-muted">
          <span aria-hidden>💰 </span>
          {formatPrice(event)} • {event.age_limit}+
        </p>

        <p className="whitespace-pre-line font-sans leading-relaxed text-primary">
          {event.description || "Описание отсутствует"}
        </p>

        {event.org_link && (
          <a
            href={event.org_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-button bg-accent px-6 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Сайт организатора
          </a>
        )}
      </div>

      <Link href="/" className="font-sans text-accent hover:underline">
        ← Назад к каталогу
      </Link>
    </div>
  );
}

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // При включённом cacheComponents динамические данные (params, fetch)
  // должны читаться внутри <Suspense>
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center font-serif text-xl text-muted">
          Загрузка...
        </div>
      }
    >
      <EventContent params={params} />
    </Suspense>
  );
}
