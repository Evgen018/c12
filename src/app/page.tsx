/* Главная страница: форма URL + кнопки действий + блок результата */
"use client";

import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Copy, X, History, Trash2, Clock, BarChart3, TrendingUp, Download } from "lucide-react";
import { translations, getTranslation, type Language } from "@/lib/translations";
import { 
  addToHistory, 
  getHistory, 
  removeFromHistory, 
  clearHistory, 
  formatHistoryDate,
  type HistoryItem 
} from "@/lib/history";
import {
  generateCacheKey,
  getFromCache,
  saveToCache,
  clearExpiredCache,
  getCacheStats,
  clearAllCache,
} from "@/lib/cache";
import {
  trackEvent,
  getOverallStats,
} from "@/lib/analytics";

export default function Home() {
  // Управление видимостью кнопки "Перевести"
  // Чтобы показать кнопку, измените значение на true
  const SHOW_TRANSLATE_BUTTON = false;

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [language, setLanguage] = useState<Language>("ru");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"about" | "thesis" | "telegram" | "translate" | "illustration" | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  
  const t = (key: keyof typeof translations.ru) => getTranslation(language, key);
  
  // Загружаем историю при монтировании и при изменении языка
  useEffect(() => {
    setHistory(getHistory());
  }, [language]);
  
  // Функция для сохранения в историю
  const saveToHistory = (
    url: string,
    mode: "about" | "thesis" | "telegram" | "translate" | "illustration",
    result: string | null,
    imageResult: string | null
  ) => {
    if (result || imageResult) {
      addToHistory({
        url,
        mode,
        result,
        imageResult,
        language
      });
      // Обновляем историю с небольшой задержкой для надежности
      setTimeout(() => {
        setHistory(getHistory());
      }, 100);
    }
  };
  
  // Функция для загрузки из истории
  const loadFromHistory = (item: HistoryItem) => {
    setUrl(item.url);
    setMode(item.mode);
    setResult(item.result);
    // Если в истории только флаг [IMAGE], не загружаем изображение
    // Пользователю нужно будет сгенерировать его заново
    setImageResult(item.imageResult && item.imageResult !== "[IMAGE]" ? item.imageResult : null);
    setLanguage(item.language);
    setError(null);
    setShowHistory(false);
    // Прокручиваем к результату
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };
  
  // Функция для удаления из истории
  const deleteFromHistory = (id: string) => {
    removeFromHistory(id);
    setHistory(getHistory());
  };
  
  // Функция для очистки истории
  const handleClearHistory = () => {
    if (confirm(language === "ru" ? "Очистить всю историю?" : "Očistiti celu istoriju?")) {
      clearHistory();
      setHistory([]);
    }
  };

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
    setImageResult(null);
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

  // Функция для скачивания изображения
  const handleDownload = () => {
    if (imageResult) {
      try {
        // Создаем временную ссылку для скачивания
        const link = document.createElement("a");
        link.href = imageResult;
        link.download = `illustration_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Отслеживаем событие
        trackEvent({ type: "function_used", function: "download_image" });
      } catch (err) {
        console.error("Failed to download:", err);
        trackEvent({ 
          type: "error", 
          function: "download_image",
          error: {
            message: err instanceof Error ? err.message : String(err),
            code: err instanceof Error ? err.name : "unknown",
          },
        });
      }
    }
  };

  // Автоматическая прокрутка к результатам после успешной генерации
  useEffect(() => {
    if ((result || imageResult) && !isLoading && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [result, imageResult, isLoading]);

  // Функция для преобразования ошибок в дружественные сообщения
  const getFriendlyErrorMessage = (
    errorType: "parse" | "ai" | "translate" | "illustration" | "network" | "unknown",
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
      
      case "illustration":
        if (statusCode === 401) {
          return t("errorIllustrationAuth");
        }
        if (statusCode === 429) {
          return t("errorIllustrationLimit");
        }
        if (statusCode === 503) {
          return t("errorIllustrationModelLoading");
        }
        if (statusCode && (statusCode === 500 || statusCode >= 502)) {
          return t("errorIllustrationService");
        }
        return t("errorIllustration");
      
      case "network":
        return t("errorNetwork");
      
      case "unknown":
      default:
        return t("errorUnknown");
    }
  };

  const handleAction = async (nextMode: "about" | "thesis" | "telegram" | "translate" | "illustration") => {
    if (!url.trim()) {
      setResult(t("errorUrlRequired"));
      setMode(null);
      setProcessStatus(null);
      setError(null);
      return;
    }

    // Очищаем устаревший кэш при каждом запросе
    clearExpiredCache();

    // Отслеживаем использование функции
    trackEvent({
      type: "function_use",
      function: nextMode,
    });

    setIsLoading(true);
    setMode(nextMode);
    setProcessStatus(t("loadingArticle"));
    setError(null);
    setResult(null);
    setImageResult(null);

    try {
      // Проверяем кэш для парсинга статьи
      const parseCacheKey = generateCacheKey(url.trim(), "parse", language);
      const cachedParse = getFromCache<any>(parseCacheKey, "parse");
      
      let parsedData;
      
      if (cachedParse) {
        // Используем кэш
        parsedData = cachedParse;
        trackEvent({ type: "cache_hit", function: "parse" });
        console.log("Using cached parse result");
      } else {
        // Парсим статью
        trackEvent({ type: "cache_miss", function: "parse" });
        trackEvent({ type: "api_call", apiProvider: "openrouter", function: "parse" });
        
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

        parsedData = await parseResponse.json();
        
        // Сохраняем в кэш
        saveToCache(parseCacheKey, parsedData, "parse");
      }

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
        // Проверяем кэш для перевода
        const translateCacheKey = generateCacheKey(url.trim(), "translate", language);
        const cachedTranslate = getFromCache<string>(translateCacheKey, "translate");
        
        if (cachedTranslate) {
          setResult(cachedTranslate);
          setProcessStatus(null);
          setError(null);
          trackEvent({ type: "cache_hit", function: "translate" });
          saveToHistory(url.trim(), "translate", cachedTranslate, null);
          setIsLoading(false);
          return;
        }
        
        trackEvent({ type: "cache_miss", function: "translate" });
        trackEvent({ type: "api_call", apiProvider: "openrouter", function: "translate" });
        
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
        const translationResult = translateData.translation || "Перевод не получен.";
        setResult(translationResult);
        setProcessStatus(null);
        setError(null);
        
        // Сохраняем в кэш
        saveToCache(translateCacheKey, translationResult, "translate");
        
        // Сохраняем в историю
        saveToHistory(url.trim(), "translate", translationResult, null);
      } else if (nextMode === "illustration") {
        // ВАЖНО: Изображения не кэшируем из-за большого размера (base64 занимает много места)
        // Изображения всегда генерируются заново, но сохраняются в истории
        trackEvent({ type: "cache_miss", function: "illustration" });
        trackEvent({ type: "api_call", apiProvider: "huggingface", function: "illustration" });
        
        // Режим генерации иллюстрации
        setProcessStatus(t("creatingIllustration"));
        const imageResponse = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            content: parsedData.content,
            language: language
          }),
        });

        if (!imageResponse.ok) {
          const errorMessage = getFriendlyErrorMessage("illustration", imageResponse.status);
          setError(errorMessage);
          setResult(null);
          setImageResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }

        const imageData = await imageResponse.json();
        
        if (!imageData.image) {
          setError(t("errorIllustration"));
          setResult(null);
          setImageResult(null);
          setIsLoading(false);
          setProcessStatus(null);
          return;
        }
        
        setImageResult(imageData.image);
        const promptResult = imageData.prompt || null;
        setResult(promptResult);
        setProcessStatus(null);
        setError(null);
        
        // НЕ сохраняем изображения в кэш - они слишком большие для localStorage
        // Изображения сохраняются только в истории (пользователь может их загрузить оттуда)
        
        // Сохраняем в историю
        saveToHistory(url.trim(), "illustration", promptResult, imageData.image);
      } else {
        // Проверяем кэш для AI обработки
        const aiCacheKey = generateCacheKey(url.trim(), nextMode, language);
        const cachedAI = getFromCache<string>(aiCacheKey, "ai");
        
        if (cachedAI) {
          setResult(cachedAI);
          setProcessStatus(null);
          setError(null);
          trackEvent({ type: "cache_hit", function: nextMode });
          saveToHistory(url.trim(), nextMode, cachedAI, null);
          setIsLoading(false);
          return;
        }
        
        trackEvent({ type: "cache_miss", function: nextMode });
        trackEvent({ type: "api_call", apiProvider: "openrouter", function: nextMode });
        
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
        
        // Сохраняем в кэш
        saveToCache(aiCacheKey, aiData.result, "ai");
        
        // Сохраняем в историю
        saveToHistory(url.trim(), nextMode, aiData.result, null);
      }
    } catch (error) {
      console.error("Error in handleAction:", error);
      
      // Отслеживаем ошибку
      trackEvent({
        type: "error",
        function: nextMode,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof Error ? error.name : "unknown",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      
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
                onClick={() => setShowStats(!showStats)}
                className="p-2 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
                aria-label={showStats ? t("statsHide") : t("statsShow")}
                title={showStats ? t("statsHide") : t("statsShow")}
              >
                <BarChart3 className="w-5 h-5 dark:text-slate-50 text-slate-900" />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
                aria-label={showHistory ? t("historyHide") : t("historyShow")}
                title={showHistory ? t("historyHide") : t("historyShow")}
              >
                <History className="w-5 h-5 dark:text-slate-50 text-slate-900" />
              </button>
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

        {/* Статистика и аналитика */}
        {showStats && (
          <section className="rounded-xl dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 border p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {t("statsTitle")}
              </h2>
            </div>
            
            {(() => {
              const stats = getOverallStats();
              const cacheStats = getCacheStats();
              const formatBytes = (bytes: number) => {
                if (bytes < 1024) return `${bytes} Б`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
                return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
              };
              
              return (
                <div className="space-y-4">
                  {/* Использование функций */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wide">
                      {t("statsFunctions")}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsTotal")}</div>
                        <div className="text-lg font-semibold dark:text-slate-100 text-slate-900">{stats.functions.total}</div>
                      </div>
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsLast7Days")}</div>
                        <div className="text-lg font-semibold dark:text-slate-100 text-slate-900">
                          {Object.values(stats.functions.last7Days).reduce((a, b) => a + b, 0)}
                        </div>
                      </div>
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsLast30Days")}</div>
                        <div className="text-lg font-semibold dark:text-slate-100 text-slate-900">
                          {Object.values(stats.functions.last30Days).reduce((a, b) => a + b, 0)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      {Object.entries(stats.functions.byFunction).map(([func, count]) => (
                        <div key={func} className="flex justify-between items-center">
                          <span className="dark:text-slate-300 text-slate-700 capitalize">{func}</span>
                          <span className="dark:text-slate-400 text-slate-500 font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* API вызовы */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wide">
                      {t("statsAPI")}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsTotalAPICalls")}</div>
                        <div className="text-lg font-semibold dark:text-slate-100 text-slate-900">{stats.api.total}</div>
                      </div>
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsCacheHitRate")}</div>
                        <div className="text-lg font-semibold dark:text-sky-400 text-sky-600">{stats.api.cacheHitRate}%</div>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex-1 dark:bg-green-900/20 bg-green-50 rounded-lg p-2 text-center">
                        <div className="dark:text-green-400 text-green-600 font-medium">{stats.api.cacheHits}</div>
                        <div className="dark:text-green-500 text-green-600 text-[10px]">{t("statsCacheHits")}</div>
                      </div>
                      <div className="flex-1 dark:bg-orange-900/20 bg-orange-50 rounded-lg p-2 text-center">
                        <div className="dark:text-orange-400 text-orange-600 font-medium">{stats.api.cacheMisses}</div>
                        <div className="dark:text-orange-500 text-orange-600 text-[10px]">{t("statsCacheMisses")}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Кэш */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wide">
                        {t("statsCache")}
                      </h3>
                      {cacheStats.total > 0 && (
                        <button
                          onClick={() => {
                            if (confirm(language === "ru" ? "Очистить весь кэш?" : "Očistiti ceo keš?")) {
                              clearAllCache();
                              setShowStats(false);
                              setTimeout(() => setShowStats(true), 100);
                            }
                          }}
                          className="text-xs dark:text-slate-400 text-slate-500 hover:dark:text-slate-300 hover:text-slate-700"
                          title={t("statsClearCacheTitle")}
                        >
                          {t("statsClearCache")}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsCacheEntries")}</div>
                        <div className="text-lg font-semibold dark:text-slate-100 text-slate-900">{cacheStats.total}</div>
                      </div>
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2">
                        <div className="dark:text-slate-400 text-slate-500">{t("statsCacheSize")}</div>
                        <div className="text-lg font-semibold dark:text-slate-100 text-slate-900">{formatBytes(cacheStats.totalSize)}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Ошибки */}
                  {stats.errors.total > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold dark:text-slate-300 text-slate-700 uppercase tracking-wide">
                        {t("statsErrors")}
                      </h3>
                      <div className="dark:bg-slate-900/60 bg-white/60 rounded-lg p-2 text-xs">
                        <div className="dark:text-slate-400 text-slate-500 mb-1">{t("statsTotalErrors")}</div>
                        <div className="text-lg font-semibold dark:text-red-400 text-red-600">{stats.errors.total}</div>
                        {stats.errors.last7Days > 0 && (
                          <div className="dark:text-slate-500 text-slate-400 mt-1">
                            {t("statsLast7Days")}: {stats.errors.last7Days}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* История запросов */}
        {showHistory && (
          <section className="rounded-xl dark:border-slate-800 border-slate-200 dark:bg-slate-950/40 bg-slate-50/80 border p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold dark:text-slate-100 text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4" />
                {t("historyTitle")}
              </h2>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-medium transition dark:bg-slate-800/80 bg-slate-100 dark:text-slate-300 text-slate-700 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200 border"
                  title={t("historyClearTitle")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t("historyClear")}</span>
                </button>
              )}
            </div>
            
            {history.length === 0 ? (
              <p className="text-sm dark:text-slate-400 text-slate-500 text-center py-4">
                {t("historyEmpty")}
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {history.map((item) => {
                  const modeLabels = {
                    about: t("historyItemAbout"),
                    thesis: t("historyItemThesis"),
                    telegram: t("historyItemTelegram"),
                    translate: t("historyItemTranslate"),
                    illustration: t("historyItemIllustration"),
                  };
                  
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg dark:bg-slate-900/60 bg-white/60 dark:border-slate-700 border-slate-300 border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium dark:text-sky-400 text-sky-600">
                              {modeLabels[item.mode]}
                            </span>
                            <span className="text-xs dark:text-slate-500 text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatHistoryDate(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs dark:text-slate-300 text-slate-700 truncate" title={item.url}>
                            {item.url}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => loadFromHistory(item)}
                            className="p-1.5 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
                            title={t("historyLoadTitle")}
                          >
                            <svg className="w-4 h-4 dark:text-slate-300 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteFromHistory(item.id)}
                            className="p-1.5 rounded-lg dark:bg-slate-800/80 bg-slate-100 dark:hover:bg-slate-700/90 hover:bg-slate-200 transition-colors"
                            title={t("historyDeleteTitle")}
                          >
                            <Trash2 className="w-4 h-4 dark:text-slate-300 text-slate-700" />
                          </button>
                        </div>
                      </div>
                      {(item.result || item.imageResult) && (
                        <div className="text-xs dark:text-slate-400 text-slate-500 line-clamp-2">
                          {item.imageResult === "[IMAGE]" ? "🖼️ Изображение (нужно сгенерировать заново)" : 
                           item.imageResult ? "🖼️ Изображение" : 
                           item.result?.substring(0, 100) + "..."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

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
            <button
              type="button"
              onClick={() => handleAction("illustration")}
              disabled={isLoading}
              title={t("illustrationButtonTitle")}
              className={`w-full sm:w-auto inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition border ${
                mode === "illustration"
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/30"
                  : "dark:bg-slate-800/80 bg-slate-100 dark:text-slate-50 text-slate-900 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-200"
              } ${isLoading ? "opacity-70 cursor-wait" : ""}`}
            >
              {t("illustrationButton")}
            </button>
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
              {(result || imageResult) && !isLoading && !imageResult && (
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

          {imageResult ? (
            <div className="mt-1 space-y-3">
              <div className="relative">
                <img 
                  src={imageResult} 
                  alt="Generated illustration" 
                  className="w-full rounded-lg border dark:border-slate-700 border-slate-300"
                />
                <button
                  type="button"
                  onClick={handleDownload}
                  className="absolute top-2 right-2 p-2 rounded-lg dark:bg-slate-800/90 bg-white/90 dark:border-slate-700 border-slate-300 dark:hover:bg-slate-700/90 hover:bg-slate-100 transition-colors shadow-lg"
                  title={t("downloadButtonTitle")}
                  aria-label={t("downloadButtonTitle")}
                >
                  <Download className="w-5 h-5 dark:text-slate-50 text-slate-900" />
                </button>
              </div>
              {result && (
                <div className="text-xs dark:text-slate-400 text-slate-500 italic">
                  <strong className="dark:text-slate-300 text-slate-600">Промпт:</strong> {result}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-sm leading-relaxed dark:text-slate-200 text-slate-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">
              {result ?? t("resultPlaceholder")}
            </div>
          )}
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
