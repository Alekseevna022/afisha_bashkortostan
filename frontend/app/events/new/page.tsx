import type { Metadata } from "next";
import Link from "next/link";
import EventForm from "@/app/components/EventForm";
import JsonImport from "@/app/components/JsonImport";

export const metadata: Metadata = {
  title: "Добавить мероприятие — Афиша Башкортостана",
};

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/"
        className="mb-4 inline-block font-sans text-sm text-accent hover:underline"
      >
        ← Назад к каталогу
      </Link>

      <h1 className="mb-2 font-serif text-4xl font-bold">
        Добавить мероприятие
      </h1>
      <p className="mb-8 font-sans text-muted">
        Заполните форму или загрузите JSON-файл сразу с несколькими
        мероприятиями.
      </p>

      <div className="space-y-8">
        <JsonImport />

        <div className="flex items-center gap-4" aria-hidden>
          <div className="h-px flex-1 bg-stone-200" />
          <span className="font-sans text-sm text-muted">или вручную</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <EventForm />
      </div>
    </div>
  );
}