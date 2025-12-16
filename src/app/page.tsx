/* Главная страница: форма URL + кнопки действий + блок результата */
"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"about" | "thesis" | "telegram" | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = (nextMode: "about" | "thesis" | "telegram") => {
    if (!url.trim()) {
      setResult("Пожалуйста, введите URL статьи.");
      setMode(null);
      return;
    }

    setIsLoading(true);
    setMode(nextMode);

    // Пока что просто имитация ответа без реального вызова AI.
    setTimeout(() => {
      if (nextMode === "about") {
        setResult(
          "Здесь будет краткое описание статьи на основе анализа ИИ.",
        );
      } else if (nextMode === "thesis") {
        setResult(
          "Здесь будут сгенерированы основные тезисы статьи в виде списка.",
        );
      } else {
        setResult(
          "Здесь будет сгенерирован готовый пост для Telegram по содержанию статьи.",
        );
      }
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl bg-slate-900/40 border border-slate-800 shadow-xl shadow-black/40 backdrop-blur-md p-6 sm:p-8 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-sky-400/90">
            референт‑переводчик
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Кратко и по делу про любую англоязычную статью
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl">
            Вставьте ссылку на статью на английском языке, выберите действие —
            и получите выжимку, тезисы или пост для Telegram.
          </p>
        </header>

        <section className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            URL статьи
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
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
                  : "bg-slate-800/80 text-slate-50 border-slate-700 hover:bg-slate-700/90"
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
                  : "bg-slate-800/80 text-slate-50 border-slate-700 hover:bg-slate-700/90"
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
                  : "bg-slate-800/80 text-slate-50 border-slate-700 hover:bg-slate-700/90"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              Пост для Telegram
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5 min-h-[140px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              Результат
            </h2>
            {isLoading && (
              <span className="text-xs text-sky-400 animate-pulse">
                Идет генерация…
              </span>
            )}
          </div>

          <div className="mt-1 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
            {result ?? "Здесь появится результат обработки статьи."}
          </div>
        </section>

        <footer className="pt-1 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Сервис-помощник для работы с англоязычными текстами.</span>
          <span className="hidden sm:inline">·</span>
          <span>Интеграция с реальным AI будет добавлена позже.</span>
        </footer>
      </main>
    </div>
  );
}
