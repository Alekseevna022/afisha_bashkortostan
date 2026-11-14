import type { Metadata } from "next";
import Link from "next/link";
import ChatWidget from "@/app/components/ChatWidget";
import "@fontsource-variable/manrope";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Афиша культуры Башкортостана",
  description: "Культурные мероприятия Республики Башкортостан",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <header className="border-b border-stone-200 bg-surface shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <Link
              href="/"
              className="font-serif text-2xl font-bold text-primary transition-colors hover:text-accent"
            >
              🎭 Афиша Башкортостана
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-stone-200 bg-surface py-6 text-center text-sm text-muted">
          Тестовый сервис • Не является официальным сайтом Минкультуры РБ
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
