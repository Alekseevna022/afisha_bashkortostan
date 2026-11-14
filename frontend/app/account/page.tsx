"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  authFetch,
  clearToken,
  getToken,
} from "@/app/lib/auth";

type User = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string | null;
};

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    authFetch("/api/v1/auth/me")
      .then(async (response) => {
        const data = await response.json();

        if (response.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(data.detail || "Ошибка загрузки профиля");
        }

        setUser(data.user);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Ошибка загрузки",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return <p className="text-muted">Загружаем профиль...</p>;
  }

  if (error) {
    return <p className="text-red-700">{error}</p>;
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-card border border-stone-200 bg-surface p-6">
        <p className="text-sm font-semibold text-accent">
          ЛИЧНЫЙ КАБИНЕТ
        </p>

        <h1 className="mt-2 font-serif text-3xl font-bold">
          {user.display_name || "Мой профиль"}
        </h1>

        <div className="mt-6 space-y-3">
          <div>
            <p className="text-xs text-muted">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>

          <div>
            <p className="text-xs text-muted">Дата регистрации</p>
            <p className="font-medium">
              {user.created_at
                ? new Date(user.created_at).toLocaleDateString("ru-RU")
                : "—"}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm"
          >
            К афише
          </Link>

          <button
            onClick={logout}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}