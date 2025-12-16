/* Главная страница: форма URL + кнопки действий + блок результата */
"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"about" | "thesis" | "telegram" | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Загружаем тему из localStorage при монтировании и применяем сразу
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Сохраняем тему в localStorage и применяем к документу при изменении
  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleAction = async (nextMode: "about" | "thesis" | "telegram") => {
    if (!url.trim()) {
      setResult("Пожалуйста, введите URL статьи.");
      setMode(null);
      return;
    }

    setIsLoading(true);
    setMode(nextMode);

    try {
      // Вызываем API для парсинга статьи
      const response = await fetch("/api/parse-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setResult(
          `Ошибка: ${errorData.error || "Не удалось обработать статью"}`
        );
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      // Форматируем JSON для красивого отображения
      const jsonResult = JSON.stringify(data, null, 2);
      setResult(jsonResult);
    } catch (error) {
      setResult(`Ошибка при обработке: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl dark:bg-slate-900/40 bg-white/80 dark:border-slate-800 border-slate-200 border shadow-xl dark:shadow-black/40 shadow-slate-900/20 backdrop-blur-md p-6 sm:p-8 space-y-8">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.25em] dark:text-sky-400/90 text-sky-600">
              референт‑переводчик
            </p>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
              aria-label="Переключить тему"
            >
              {theme === "dark" ? (
                <svg
                  className="w-5 h-5 dark:text-slate-50 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 dark:text-slate-50 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight dark:text-slate-50 text-slate-900">
            Кратко и по делу про любую англоязычную статью
          </h1>
          <p className="text-sm sm:text-base dark:text-slate-300 text-slate-600 max-w-xl">
            Вставьте ссылку на статью на английском языке, выберите действие —
            и получите выжимку, тезисы или пост для Telegram.
          </p>
        </header>

        <section className="space-y-4">
          <label className="block text-sm font-medium dark:text-slate-200 text-slate-700">
            URL статьи
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-xl dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white dark:text-slate-50 text-slate-900 px-3 py-2.5 text-sm dark:placeholder:text-slate-500 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition border"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAction("about")}
              disabled={isLoading}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "about"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              О чем статья?
            </button>
            <button
              type="button"
              onClick={() => handleAction("thesis")}
              disabled={isLoading}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "thesis"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              Тезисы
            </button>
            <button
              type="button"
              onClick={() => handleAction("telegram")}
              disabled={isLoading}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "telegram"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              Пост для Telegram
            </button>
          </div>
        </section>

        <section className="rounded-xl dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 border p-4 sm:p-5 min-h-[140px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-900">
              Результат
            </h2>
            {isLoading && (
              <span className="text-xs dark:text-sky-400 text-sky-600 animate-pulse">
                Идет генерация…
              </span>
            )}
          </div>

          <div className="mt-1 text-sm leading-relaxed dark:text-slate-200 text-slate-700 whitespace-pre-wrap">
            {result ?? "Здесь появится результат обработки статьи."}
          </div>
        </section>

        <footer className="pt-1 text-[11px] dark:text-slate-500 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Сервис-помощник для работы с англоязычными текстами.</span>
          <span className="hidden sm:inline">·</span>
          <span>Интеграция с реальным AI будет добавлена позже.</span>
        </footer>
      </main>
    </div>
  );
}
