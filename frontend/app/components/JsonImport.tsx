"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { API_URL } from "@/app/lib/events";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ
const MAX_SHOWN_ERRORS = 10;

/** Совпадает с отчётом backend/app/services/importer.py */
interface ImportReport {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type ImportState =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string }
  | { kind: "done"; fileName: string; report: ImportReport }
  | { kind: "error"; message: string };

const EXAMPLE = [
  {
    title: "Вечер органной музыки",
    category: "concert",
    date_start: "2026-12-05T19:00:00",
    city: "Уфа",
    venue: "Башкирская государственная филармония",
    address: "ул. Ленина, 62",
    description: "Произведения Баха и Букстехуде",
    price_min: 500,
    price_max: 1500,
    is_free: false,
    age_limit: 6,
    org_link: "https://example.com",
  },
  {
    title: "Выставка «Сокровища Башкирии»",
    category: "exhibition",
    date_start: "2026-12-10T10:00:00",
    date_end: "2027-01-31T18:00:00",
    city: "Уфа",
    venue: "Национальный музей РБ",
    is_free: true,
    age_limit: 0,
  },
];

function downloadExample() {
  const blob = new Blob([JSON.stringify(EXAMPLE, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "events_example.json";
  link.click();
  URL.revokeObjectURL(url);
}

export default function JsonImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ kind: "idle" });

  const uploading = state.kind === "uploading";

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      setState({ kind: "error", message: "Нужен файл с расширением .json" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setState({ kind: "error", message: "Файл больше 10 МБ" });
      return;
    }

    setState({ kind: "uploading", fileName: file.name });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/api/v1/admin/import/json`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          detail?: unknown;
        } | null;
        setState({
          kind: "error",
          message:
            typeof err?.detail === "string"
              ? err.detail
              : `Не удалось загрузить файл (HTTP ${res.status})`,
        });
        return;
      }

      const data = (await res.json()) as { report: ImportReport };
      setState({ kind: "done", fileName: file.name, report: data.report });
    } catch (err) {
      console.error(err);
      setState({
        kind: "error",
        message: `Не удалось связаться с API (${API_URL}). Проверьте, что сервер запущен.`,
      });
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Сбрасываем значение, чтобы тот же файл можно было выбрать повторно
    e.target.value = "";
    if (file) void upload(file);
  }

  return (
    <section
      aria-labelledby="json-import-title"
      className="rounded-card border border-stone-200 bg-surface p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 id="json-import-title" className="font-serif text-2xl font-bold">
            Добавить много мероприятий сразу
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">
            Загрузите JSON-файл со списком мероприятий. Одинаковые (то же
            название, дата начала и площадка) не задваиваются: существующие
            обновляются.
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-button border border-accent bg-surface px-6 py-2.5 font-sans text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
          >
            {uploading ? "Загружаем…" : "Загрузить JSON"}
          </button>
        </div>
      </div>

      {/* Результат */}
      <div aria-live="polite">
        {state.kind === "uploading" && (
          <p className="mt-4 font-sans text-sm text-muted">
            Обрабатываем «{state.fileName}»…
          </p>
        )}

        {state.kind === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm font-semibold text-red-800"
          >
            {state.message}
          </p>
        )}

        {state.kind === "done" && (
          <div className="mt-4 space-y-3">
            <p className="font-sans text-sm text-muted">
              Файл «{state.fileName}» обработан
            </p>
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Добавлено", value: state.report.added },
                { label: "Обновлено", value: state.report.updated },
                { label: "Пропущено", value: state.report.skipped },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-stone-200 bg-background px-3 py-3"
                >
                  <dd className="font-sans text-2xl font-bold">{item.value}</dd>
                  <dt className="font-sans text-xs text-muted">{item.label}</dt>
                </div>
              ))}
            </dl>

            {state.report.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-sans text-sm text-amber-900">
                <p className="mb-1 font-semibold">
                  Не удалось обработать строк: {state.report.errors.length}
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-xs">
                  {state.report.errors.slice(0, MAX_SHOWN_ERRORS).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
                {state.report.errors.length > MAX_SHOWN_ERRORS && (
                  <p className="mt-1 text-xs">
                    …и ещё {state.report.errors.length - MAX_SHOWN_ERRORS}
                  </p>
                )}
              </div>
            )}

            {state.report.added + state.report.updated > 0 && (
              <Link
                href="/"
                className="inline-block font-sans text-sm text-accent hover:underline"
              >
                Перейти к афише →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Формат файла */}
      <details className="mt-5 border-t border-stone-100 pt-4">
        <summary className="cursor-pointer font-sans text-sm font-semibold">
          Какой формат файла?
        </summary>
        <div className="mt-3 space-y-3 font-sans text-sm text-muted">
          <p>
            Массив объектов (или один объект). Обязательны{" "}
            <code className="rounded bg-stone-100 px-1 text-primary">title</code>{" "}
            и{" "}
            <code className="rounded bg-stone-100 px-1 text-primary">
              date_start
            </code>
            ; без{" "}
            <code className="rounded bg-stone-100 px-1 text-primary">city</code>{" "}
            и{" "}
            <code className="rounded bg-stone-100 px-1 text-primary">
              category
            </code>{" "}
            мероприятие сохранится с городом «Не указан» и категорией «Другое».
            Категории: concert, play, exhibition, festival, cinema, tour, other.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs leading-relaxed text-primary">
            {JSON.stringify(EXAMPLE[0], null, 2)}
          </pre>
          <button
            type="button"
            onClick={downloadExample}
            className="text-accent underline-offset-4 hover:underline"
          >
            Скачать пример файла
          </button>
        </div>
      </details>
    </section>
  );
}