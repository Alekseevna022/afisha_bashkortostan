
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  authFetch,
  clearToken,
  getToken,
} from "@/app/lib/auth";

import EventCard from "@/app/components/EventCard";
import type { AfishaEvent } from "@/app/lib/events";

type User = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string | null;
};

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

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [favoriteEvents, setFavoriteEvents] = useState<AfishaEvent[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    let active = true;

    async function loadAccount() {
      try {
        // Загружаем профиль пользователя
        const response = await authFetch("/api/v1/auth/me");
        const data = await response.json();

        if (response.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.detail || "Не удалось загрузить профиль"
          );
        }

        if (!active) return;

        setUser(data.user);

        // Загружаем избранные мероприятия
        try {
          const favoritesResponse = await authFetch(
            "/api/v1/favorites"
          );

          if (favoritesResponse.status === 401) {
            clearToken();
            router.replace("/login");
            return;
          }

          if (!favoritesResponse.ok) {
            const favoritesData = await favoritesResponse
              .json()
              .catch(() => ({}));

            throw new Error(
              favoritesData.detail ||
              "Не удалось загрузить избранное"
            );
          }

          const favoritesData = await favoritesResponse.json();

          if (active) {
            setFavoriteEvents(favoritesData.items || []);
          }
        } catch (err) {
          if (active) {
            setFavoritesError(
              err instanceof Error
                ? err.message
                : "Ошибка загрузки избранного"
            );
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Ошибка загрузки профиля"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setFavoritesLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/");
    router.refresh();
  }

  function handleFavoriteChange(
    eventId: string,
    value: boolean
  ) {
    if (!value) {
      setFavoriteEvents((current) =>
        current.filter((event) => event.id !== eventId)
      );
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-sm text-muted">
        Загружаем личный кабинет...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-white p-6">
        <p className="text-sm text-red-700">{error}</p>

        <Link
          href="/login"
          className="mt-4 inline-block text-sm underline"
        >
          Вернуться ко входу
        </Link>
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.display_name || "Пользователь";

  const registrationDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Не указана";

  return (
    <div className="mx-auto max-w-6xl">

      {/* Навигация по разделу */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div className="text-sm text-muted">
          <Link
            href="/"
            className="transition-colors hover:text-accent"
          >
            Главная
          </Link>

          <span className="mx-2 text-stone-400">/</span>

          <span className="text-primary">
            Личный кабинет
          </span>
        </div>

        <span className="text-xs tracking-wide text-muted">
          УФА · БАШКОРТОСТАН
        </span>
      </div>

      {/* Заголовок */}
      <div className="mb-9">
        <p className="mb-2 text-sm text-accent">
          Ваш профиль на Афише
        </p>

        <h1 className="font-serif text-4xl font-semibold text-primary sm:text-5xl">
          Личный кабинет
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Управляйте своим профилем и сохраняйте интересные события
          культурной жизни республики.
        </p>
      </div>

      {/* Орнаментальная линия */}
      <div className="mb-9 overflow-hidden text-accent">
        <BashkortOrnament />
      </div>

      <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">

        {/* Боковая навигация */}
        <aside>
          <div className="mb-5 border-b border-stone-200 pb-5">
            <p className="text-xs text-muted">
              Вы вошли как
            </p>

            <p className="mt-2 break-words font-medium text-primary">
              {user.email}
            </p>
          </div>

          <nav className="space-y-1">
            <a
              href="#profile"
              className="block border-l-2 border-accent bg-white px-4 py-3 text-sm font-semibold text-primary"
            >
              Мои данные
            </a>

            <a
              href="#favorites"
              className="flex items-center justify-between border-l-2 border-transparent px-4 py-3 text-sm text-muted transition-colors hover:border-stone-400 hover:text-primary"
            >
              <span>Избранное</span>

              <span className="text-xs text-stone-400">
                {favoriteEvents.length}
              </span>
            </a>

            <Link
              href="/"
              className="block border-l-2 border-transparent px-4 py-3 text-sm text-muted transition-colors hover:border-stone-400 hover:text-primary"
            >
              Перейти к афише
            </Link>
          </nav>

          <div className="mt-8 border-t border-stone-200 pt-5">
            <button
              onClick={logout}
              className="text-sm text-muted transition-colors hover:text-red-700"
            >
              Выйти из аккаунта
            </button>
          </div>
        </aside>

        {/* Основное содержимое */}
        <div className="min-w-0">

          {/* Профиль */}
          <section
            id="profile"
            className="scroll-mt-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-5">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Основная информация
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Данные вашей учётной записи
                </p>
              </div>

              <span className="border border-emerald-800/20 px-3 py-1.5 text-xs text-emerald-800">
                Аккаунт активен
              </span>
            </div>

            {/* Имя */}
            <div className="grid gap-2 border-b border-stone-200 py-6 sm:grid-cols-[190px_minmax(0,1fr)]">
              <p className="text-sm text-muted">
                Имя
              </p>

              <p className="text-sm font-medium text-primary">
                {displayName}
              </p>
            </div>

            {/* Почта */}
            <div className="grid gap-2 border-b border-stone-200 py-6 sm:grid-cols-[190px_minmax(0,1fr)]">
              <p className="text-sm text-muted">
                Электронная почта
              </p>

              <p className="break-all text-sm font-medium text-primary">
                {user.email}
              </p>
            </div>

            {/* Регистрация */}
            <div className="grid gap-2 border-b border-stone-200 py-6 sm:grid-cols-[190px_minmax(0,1fr)]">
              <p className="text-sm text-muted">
                Дата регистрации
              </p>

              <p className="text-sm font-medium text-primary">
                {registrationDate}
              </p>
            </div>

            {/* ID */}
            <div className="grid gap-2 border-b border-stone-200 py-6 sm:grid-cols-[190px_minmax(0,1fr)]">
              <p className="text-sm text-muted">
                Идентификатор
              </p>

              <p className="break-all font-mono text-xs text-muted">
                {user.id}
              </p>
            </div>
          </section>

          {/* Избранное */}
          <section
            id="favorites"
            className="mt-14 scroll-mt-8"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-5">
              <div>
                <p className="text-xs tracking-widest text-accent">
                  ВАША ПОДБОРКА
                </p>

                <h2 className="mt-2 font-serif text-2xl font-semibold text-primary">
                  Избранные мероприятия
                </h2>

                <p className="mt-1 text-sm text-muted">
                  События, которые вы сохранили на будущее
                </p>
              </div>

              <span className="text-sm text-muted">
                {favoriteEvents.length} мероприятий
              </span>
            </div>

            {favoritesLoading ? (
              <p className="py-8 text-sm text-muted">
                Загружаем избранное...
              </p>
            ) : favoritesError ? (
              <div className="py-8">
                <p className="text-sm text-red-700">
                  {favoritesError}
                </p>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-3 text-sm text-primary underline underline-offset-4"
                >
                  Попробовать снова
                </button>
              </div>
            ) : favoriteEvents.length === 0 ? (
              <div className="border-b border-stone-200 py-10">
                <p className="font-serif text-xl text-primary">
                  Здесь пока ничего нет
                </p>

                <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                  Сохраняйте интересные концерты, выставки и другие
                  события с помощью сердечка на карточке мероприятия.
                </p>

                <Link
                  href="/"
                  className="mt-5 inline-flex border-b border-accent pb-1 text-sm font-semibold text-primary transition-colors hover:text-accent"
                >
                  Найти интересные события →
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {favoriteEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isFavorite={true}
                    onFavoriteChange={handleFavoriteChange}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Региональная деталь */}
          <section className="mt-12 border border-stone-200 bg-white p-6 sm:p-8">
            <div className="max-w-2xl">
              <p className="text-xs tracking-widest text-accent">
                КУЛЬТУРНАЯ ЖИЗНЬ РЕСПУБЛИКИ
              </p>

              <h2 className="mt-3 font-serif text-2xl font-semibold text-primary">
                Открывайте Башкортостан
              </h2>

              <p className="mt-3 text-sm leading-6 text-muted">
                Концерты в Уфе, театральные премьеры, выставки,
                фестивали и события в городах и районах республики.
                Выбирайте, куда отправиться дальше.
              </p>

              <Link
                href="/"
                className="mt-6 inline-flex border-b border-accent pb-1 text-sm font-semibold text-primary transition-colors hover:text-accent"
              >
                Смотреть мероприятия →
              </Link>
            </div>

            <div className="mt-8 text-accent">
              <BashkortOrnament />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
