import Link from "next/link";
import EventList from "@/app/components/EventList";

export default function Home() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl font-bold">
          Культурные мероприятия
        </h1>
        <Link
          href="/events/new"
          className="rounded-button bg-accent px-6 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          + Добавить мероприятие
        </Link>
      </div>
      <EventList />
    </div>
  );
}