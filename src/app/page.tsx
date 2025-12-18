/* Главная страница: форма URL + кнопки действий + блок результата */
"use client";

import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Copy, X } from "lucide-react";
import { translations, getTranslation, type Language } from "@/lib/translations";

export default function Home() {
  // Управление видимостью кнопки "Перевести"
  // Чтобы показать кнопку, измените значение на true
  const SHOW_TRANSLATE_BUTTON = false;

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [language, setLanguage] = useState<Language>("ru");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"about" | "thesis" | "telegram" | "translate" | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  
  const t = (key: keyof typeof translations.ru) => getTranslation(language, key);

  // Загружаем тему и язык из localStorage при монтировании и применяем сразу
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    const savedLanguage = localStorage.getItem("language") as Language | null;
    if (savedLanguage) {
      setLanguage(savedLanguage);
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

  // Сохраняем язык в localStorage при изменении
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "ru" ? "me" : "ru"));
  };

  // Функция для очистки всех состояний
  const handleClear = () => {
    setUrl("");
    setResult(null);
    setError(null);
    setMode(null);
    setProcessStatus(null);
    setIsLoading(false);
    setCopied(false);
  };

  // Функция для копирования результата в буфер обмена
  const handleCopy = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  // Автоматическая прокрутка к результатам после успешной генерации
  useEffect(() => {
    if (result && !isLoading && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [result, isLoading]);

  // Функция для преобразования ошибок в дружественные сообщения
  const getFriendlyErrorMessage = (
    errorType: "parse" | "ai" | "translate" | "network" | "unknown",
    statusCode?: number,
    originalError?: string
  ): string => {
    switch (errorType) {
      case "parse":
        return t("errorLoadArticle");
      
      case "ai":
        if (statusCode === 401) {
          return t("errorAIAuth");
        }
        if (statusCode === 429) {
          return t("errorAILimit");
        }
        if (statusCode && (statusCode === 500 || statusCode >= 502)) {
          return t("errorAIService");
        }
        return t("errorAIProcess");
      
      case "translate":
        if (statusCode === 401) {
          return t("errorTranslateAuth");
        }
        if (statusCode === 429) {
          return t("errorTranslateLimit");
        }
        if (statusCode && (statusCode === 500 || statusCode >= 502)) {
          return t("errorTranslateService");
        }
        return t("errorTranslate");
      
      case "network":
        return t("errorNetwork");
      
      case "unknown":
      default:
        return t("errorUnknown");
    }
  };

  const handleAction = async (nextMode: "about" | "thesis" | "telegram" | "translate") => {
    if (!url.trim()) {
      setResult(t("errorUrlRequired"));
      setMode(null);
      setProcessStatus(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setMode(nextMode);
    setProcessStatus(t("loadingArticle"));
    setError(null);
    setResult(null);

    try {
      // Сначала парсим статью
      const parseResponse = await fetch("/api/parse-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!parseResponse.ok) {
        const errorMessage = getFriendlyErrorMessage("parse", parseResponse.status);
        setError(errorMessage);
        setResult(null);
        setIsLoading(false);
        setProcessStatus(null);
        return;
      }

      const parsedData = await parseResponse.json();

      // Проверяем наличие контента
      if (!parsedData.content) {
        setError(t("errorLoadArticle"));
        setResult(null);
        setIsLoading(false);
        setProcessStatus(null);
        return;
      }

      // Проверяем минимальную длину контента
      if (parsedData.content.trim().length < 50) {
        setError(t("errorLoadArticle"));
        setResult(null);
        setIsLoading(false);
        setProcessStatus(null);
        return;
      }

      // Если режим перевода, переводим контент
      if (nextMode === "translate") {
        setProcessStatus(t("translating"));
        const translateResponse = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            content: parsedData.content,
            targetLanguage: language 
          }),
        });

        if (!translateResponse.ok) {
          const errorMessage = getFriendlyErrorMessage("translate", translateResponse.status);
          setError(errorMessage);
          setResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }

        const translateData = await translateResponse.json();
        setResult(translateData.translation || "Перевод не получен.");
        setProcessStatus(null);
        setError(null);
      } else {
        // Для режимов about, thesis, telegram вызываем AI-обработку
        const statusMessages = {
          about: t("analyzingArticle"),
          thesis: t("formingThesis"),
          telegram: t("creatingTelegramPost")
        };
        setProcessStatus(statusMessages[nextMode]);
        const aiResponse = await fetch("/api/ai-process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            content: parsedData.content,
            mode: nextMode,
            language: language
          }),
        });

        if (!aiResponse.ok) {
          const errorMessage = getFriendlyErrorMessage("ai", aiResponse.status);
          setError(errorMessage);
          setResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }

        const aiData = await aiResponse.json();
        
        if (!aiData.result || aiData.result.trim().length === 0) {
          setError(t("errorAIEmpty"));
          setResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }
        
        setResult(aiData.result);
        setProcessStatus(null);
        setError(null);
      }
    } catch (error) {
      console.error("Error in handleAction:", error);
      // Проверяем, является ли ошибка сетевой
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setError(getFriendlyErrorMessage("network"));
      } else {
        setError(getFriendlyErrorMessage("unknown"));
      }
      setResult(null);
      setProcessStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen dark:bg-slate-950 bg-slate-50 dark:text-slate-50 text-slate-900 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
      <main className="w-full max-w-3xl rounded-2xl dark:bg-slate-900/40 bg-white/80 dark:border-slate-800 border-slate-200 border shadow-xl dark:shadow-black/40 shadow-slate-900/20 backdrop-blur-md p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.25em] dark:text-sky-400/90 text-sky-600">
              {t("appName")}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="px-2.5 py-1.5 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors text-xs font-medium dark:text-slate-300 text-slate-700 border"
                aria-label={language === "ru" ? "Switch to Montenegrin" : "Переключить на русский"}
                title={language === "ru" ? "Switch to Montenegrin" : "Переключить на русский"}
              >
                {language === "ru" ? "ME" : "РУ"}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
                aria-label={language === "ru" ? "Переключить тему" : "Promijeni temu"}
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
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight dark:text-slate-50 text-slate-900 break-words">
            {t("title")}
          </h1>
          <p className="text-sm sm:text-base dark:text-slate-300 text-slate-600 max-w-xl break-words">
            {t("description")}
          </p>
        </header>

        <section className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <label className="block text-sm font-medium dark:text-slate-200 text-slate-700">
              {t("urlLabel")}
            </label>
            {url.trim() && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading}
                title={t("clearButtonTitle")}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition dark:bg-slate-800/80 bg-slate-100 dark:text-slate-300 text-slate-700 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 border disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{t("clearButton")}</span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="url"
              placeholder={t("urlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl dark:border-slate-700 border-slate-300 dark:bg-slate-900/60 bg-white dark:text-slate-50 text-slate-900 px-3 sm:px-4 py-2.5 text-sm dark:placeholder:text-slate-500 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition border"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAction("about")}
              disabled={isLoading}
              title={t("aboutButtonTitle")}
              className={`w-full sm:w-auto inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "about"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              {t("aboutButton")}
            </button>
            <button
              type="button"
              onClick={() => handleAction("thesis")}
              disabled={isLoading}
              title={t("thesisButtonTitle")}
              className={`w-full sm:w-auto inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "thesis"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              {t("thesisButton")}
            </button>
            <button
              type="button"
              onClick={() => handleAction("telegram")}
              disabled={isLoading}
              title={t("telegramButtonTitle")}
              className={`w-full sm:w-auto inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "telegram"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              {t("telegramButton")}
            </button>
            {SHOW_TRANSLATE_BUTTON && (
              <button
                type="button"
                onClick={() => handleAction("translate")}
                disabled={isLoading}
                title={t("translateButtonTitle")}
                className={`w-full sm:w-auto inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                  mode === "translate"
                    ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                    : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
                } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
              >
                {t("translateButton")}
              </button>
            )}
          </div>
        </section>

        {processStatus && (
          <div className="rounded-xl dark:bg-sky-500/10 bg-sky-50 dark:border-sky-500/20 border-sky-200 border p-3 sm:p-4">
            <p className="text-sm dark:text-sky-400 text-sky-600 font-medium break-words">
              {processStatus}
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="break-words">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertTitle>{t("errorTitle")}</AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        <section 
          ref={resultRef}
          className="rounded-xl dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 border p-4 sm:p-5 min-h-[140px] space-y-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-900">
              {t("resultTitle")}
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isLoading && (
                <span className="text-xs dark:text-sky-400 text-sky-600 animate-pulse whitespace-nowrap">
                  {t("generating")}
                </span>
              )}
              {result && !isLoading && (
                <button
                  type="button"
                  onClick={handleCopy}
                  title={t("copyButtonTitle")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-medium transition dark:bg-slate-800/80 bg-slate-100 dark:text-slate-300 text-slate-700 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 border"
                >
                  <Copy className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">{copied ? t("copied") : t("copyButton")}</span>
                  <span className="sm:hidden">{copied ? "✓" : ""}</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-1 text-sm leading-relaxed dark:text-slate-200 text-slate-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {result ?? t("resultPlaceholder")}
          </div>
        </section>

        <footer className="pt-1 text-[11px] sm:text-xs dark:text-slate-500 text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
          <span>{t("footerService")}</span>
          <span className="hidden sm:inline">·</span>
          <span>{t("footerAI")}</span>
        </footer>
      </main>
    </div>
  );
}
