"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL } from "@/app/lib/events";
import { saveToken } from "@/app/lib/auth";

type Mode = "login" | "register";

export default function AuthForm() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "/api/v1/auth/login"
          : "/api/v1/auth/register";

      const body =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              display_name: displayName,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Не удалось выполнить запрос",
        );
      }

      saveToken(data.access_token);
      router.push("/account");
      router.refresh();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-card border border-stone-200 bg-surface p-6 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-accent">
          АФИША БАШКОРТОСТАНА
        </p>

        <h1 className="font-serif text-3xl font-bold text-primary">
          {mode === "login"
            ? "Вход в аккаунт"
            : "Создание аккаунта"}
        </h1>

        <p className="mt-2 text-sm text-muted">
          {mode === "login"
            ? "Войди, чтобы пользоваться личным кабинетом."
            : "Зарегистрируйся, чтобы создать личный кабинет."}
        </p>

        <div className="my-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${
              mode === "login"
                ? "border-accent bg-accent text-white"
                : "border-stone-300"
            }`}
          >
            Войти
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${
              mode === "register"
                ? "border-accent bg-accent text-white"
                : "border-stone-300"
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Имя
              </label>

              <input
                type="text"
                value={displayName}
                onChange={(event) =>
                  setDisplayName(event.target.value)
                }
                maxLength={160}
                placeholder="Как тебя зовут?"
                className="w-full rounded-lg border border-stone-300 bg-background px-3 py-3 outline-none focus:border-accent"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Email
            </label>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@mail.ru"
              className="w-full rounded-lg border border-stone-300 bg-background px-3 py-3 outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Пароль
            </label>

            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Минимум 8 символов"
              className="w-full rounded-lg border border-stone-300 bg-background px-3 py-3 outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-button bg-accent px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Подожди..."
              : mode === "login"
                ? "Войти"
                : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}