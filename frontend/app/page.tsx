import Link from "next/link";
import EventList from "@/app/components/EventList";

function BashkortOrnament() {
  return (
    <svg
      viewBox="0 0 600 22"
      className="h-5 w-full"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 11 H600"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.35"
      />
      {Array.from({ length: 15 }).map((_, index) => (
        <path
          key={index}
          d="M0 -6 L8 2 L0 10 L-8 2 Z M0 12 L8 20 L0 28 L-8 20 Z"
          transform={`translate(${20 + index * 40} 0)`}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.7"
        />
      ))}
    </svg>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Навигация по разделу */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <span className="text-sm text-primary">Афиша</span>

        <span className="text-xs tracking-wide text-muted">
          УФА · БАШКОРТОСТАН
        </span>
      </div>

      {/* Заголовок */}
      <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-sm text-accent">
            Культурная жизнь республики
          </p>

          <h1 className="font-serif text-4xl font-semibold text-primary sm:text-5xl">
            Культурные мероприятия
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Концерты, спектакли, выставки и фестивали Уфы и всего
            Башкортостана. Выберите дату, категорию или город.
          </p>
        </div>

        <Link
          href="/events/new"
          className="inline-flex border-b border-accent pb-1 text-sm font-semibold text-primary transition-colors hover:text-accent"
        >
          + Добавить мероприятие
        </Link>
      </div>

      {/* Орнаментальная линия */}
      <div className="mb-9 overflow-hidden text-accent">
        <BashkortOrnament />
      </div>

      <EventList />
    </div>
  );
}