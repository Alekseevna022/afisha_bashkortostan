"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API_URL, type AfishaEvent } from "@/app/lib/events";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  eventIds?: string[];
  error?: boolean;
}

interface ChatApiResponse {
  reply: string;
  events: { id: string }[];
  session_id: string;
}

const REQUEST_TIMEOUT_MS = 45_000; // бэкенд ждёт LLM до 30 с
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const SUGGESTIONS = [
  "Что интересного в Уфе на этой неделе?",
  "Бесплатные концерты",
  "Куда сходить с детьми?",
];

/** Рендерит **жирный** и переносы строк без dangerouslySetInnerHTML. */
function FormattedText({ text }: { text: string }) {
  const clean = text.replace(UUID_RE, "").replace(/[ \t]+\n/g, "\n").trim();
  return (
    <>
      {clean.split("\n").map((line, i) => (
        <span key={i} className="block min-h-[1em]">
          {line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
          )}
        </span>
      ))}
    </>
  );
}

/** Ссылки на события, которые упомянул агент. */
function EventLinks({ ids }: { ids: string[] }) {
  const [events, setEvents] = useState<AfishaEvent[]>([]);
  const idsKey = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      idsKey.split(",").map((id) =>
        fetch(`${API_URL}/api/v1/events/${id}`)
          .then((res) => (res.ok ? (res.json() as Promise<AfishaEvent>) : null))
          .catch(() => null),
      ),
    ).then((list) => {
      if (!cancelled) {
        setEvents(list.filter((e): e is AfishaEvent => e !== null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  if (events.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="rounded-lg border border-stone-200 bg-background px-3 py-2 text-xs font-semibold text-accent transition-colors hover:border-accent"
        >
          {event.title} →
        </Link>
      ))}
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    // В историю уходят только нормальные реплики (без сообщений об ошибках)
    const history = messages
      .filter((m) => !m.error)
      .map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, role: "user", content },
    ]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_URL}/api/v1/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          session_id: sessionId.current,
          history,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as ChatApiResponse;
      sessionId.current = data.session_id;
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          content: data.reply,
          eventIds: data.events.map((e) => e.id),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          content: "Не удалось получить ответ. Попробуйте ещё раз чуть позже.",
          error: true,
        },
      ]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="Чат с ИИ-помощником"
          className="flex h-[32rem] max-h-[80vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card border border-stone-200 bg-surface shadow-xl sm:w-96"
        >
          <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
            <div>
              <p className="font-serif text-xl font-bold leading-none">
                Помощник афиши
              </p>
              <p className="mt-1 font-sans text-xs text-muted">
                Подберу мероприятие в Башкортостане
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Закрыть чат"
              className="rounded-full p-2 text-muted transition-colors hover:text-primary"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 font-sans text-sm">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-muted">
                  Привет! Расскажите, что ищете: город, жанр, бюджет.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border border-stone-200 px-3 py-2 text-left transition-colors hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "flex justify-end" : "flex"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent text-white"
                      : m.error
                        ? "bg-red-50 text-red-800"
                        : "bg-stone-100 text-primary"
                  }`}
                >
                  <FormattedText text={m.content} />
                  {m.eventIds && m.eventIds.length > 0 && (
                    <EventLinks ids={m.eventIds} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex">
                <div className="rounded-2xl bg-stone-100 px-4 py-2 text-muted">
                  Печатает…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-stone-200 p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишите сообщение…"
              aria-label="Сообщение"
              maxLength={500}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-background px-4 py-2 font-sans text-sm transition-colors focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-button bg-accent px-4 py-2 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              →
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Закрыть чат" : "Открыть чат с ИИ-помощником"}
        aria-expanded={open}
        className="rounded-button bg-accent px-5 py-3 font-sans text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
      >
        {open ? "Закрыть" : "💬 Спросить ИИ"}
      </button>
    </div>
  );
}