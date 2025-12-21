// Система мониторинга и аналитики

export type AnalyticsEvent = {
  type: "function_use" | "error" | "api_call" | "cache_hit" | "cache_miss";
  function?: "about" | "thesis" | "telegram" | "translate" | "illustration" | "parse";
  error?: {
    message: string;
    code?: string | number;
    stack?: string;
  };
  apiProvider?: "openrouter" | "huggingface" | "replicate";
  timestamp: number;
  metadata?: Record<string, any>;
};

const ANALYTICS_KEY = "article_processor_analytics";
const MAX_ANALYTICS_ENTRIES = 1000; // Максимум записей для хранения

/**
 * Сохранить событие аналитики
 */
export function trackEvent(event: Omit<AnalyticsEvent, "timestamp">): void {
  if (typeof window === "undefined") return;
  
  try {
    const analytics = getAnalytics();
    const newEvent: AnalyticsEvent = {
      ...event,
      timestamp: Date.now(),
    };
    
    analytics.push(newEvent);
    
    // Ограничиваем количество записей
    const limited = analytics.slice(-MAX_ANALYTICS_ENTRIES);
    
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error("Error tracking event:", error);
  }
}

/**
 * Получить все события аналитики
 */
export function getAnalytics(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as AnalyticsEvent[];
  } catch (error) {
    console.error("Error reading analytics:", error);
    return [];
  }
}

/**
 * Получить статистику использования функций
 */
export function getFunctionStats(): {
  total: number;
  byFunction: Record<string, number>;
  last7Days: Record<string, number>;
  last30Days: Record<string, number>;
} {
  const analytics = getAnalytics();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  const byFunction: Record<string, number> = {};
  const last7Days: Record<string, number> = {};
  const last30Days: Record<string, number> = {};
  let total = 0;
  
  for (const event of analytics) {
    if (event.type === "function_use" && event.function) {
      total++;
      byFunction[event.function] = (byFunction[event.function] || 0) + 1;
      
      if (event.timestamp >= sevenDaysAgo) {
        last7Days[event.function] = (last7Days[event.function] || 0) + 1;
      }
      
      if (event.timestamp >= thirtyDaysAgo) {
        last30Days[event.function] = (last30Days[event.function] || 0) + 1;
      }
    }
  }
  
  return {
    total,
    byFunction,
    last7Days,
    last30Days,
  };
}

/**
 * Получить статистику ошибок
 */
export function getErrorStats(): {
  total: number;
  byType: Record<string, number>;
  recent: AnalyticsEvent[];
  last7Days: number;
} {
  const analytics = getAnalytics();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  const byType: Record<string, number> = {};
  const recent: AnalyticsEvent[] = [];
  let total = 0;
  let last7Days = 0;
  
  for (const event of analytics) {
    if (event.type === "error") {
      total++;
      const errorType = event.error?.code?.toString() || event.error?.message || "unknown";
      byType[errorType] = (byType[errorType] || 0) + 1;
      
      if (event.timestamp >= sevenDaysAgo) {
        last7Days++;
      }
      
      // Последние 10 ошибок
      if (recent.length < 10) {
        recent.push(event);
      }
    }
  }
  
  // Сортируем по дате (новые первыми)
  recent.sort((a, b) => b.timestamp - a.timestamp);
  
  return {
    total,
    byType,
    recent,
    last7Days,
  };
}

/**
 * Получить статистику API вызовов
 */
export function getApiStats(): {
  total: number;
  byProvider: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  last7Days: {
    total: number;
    byProvider: Record<string, number>;
  };
} {
  const analytics = getAnalytics();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  const byProvider: Record<string, number> = {};
  const last7DaysByProvider: Record<string, number> = {};
  let total = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let last7DaysTotal = 0;
  
  for (const event of analytics) {
    if (event.type === "api_call") {
      total++;
      if (event.apiProvider) {
        byProvider[event.apiProvider] = (byProvider[event.apiProvider] || 0) + 1;
      }
      
      if (event.timestamp >= sevenDaysAgo) {
        last7DaysTotal++;
        if (event.apiProvider) {
          last7DaysByProvider[event.apiProvider] = (last7DaysByProvider[event.apiProvider] || 0) + 1;
        }
      }
    } else if (event.type === "cache_hit") {
      cacheHits++;
    } else if (event.type === "cache_miss") {
      cacheMisses++;
    }
  }
  
  const totalCacheRequests = cacheHits + cacheMisses;
  const cacheHitRate = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0;
  
  return {
    total,
    byProvider,
    cacheHits,
    cacheMisses,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    last7Days: {
      total: last7DaysTotal,
      byProvider: last7DaysByProvider,
    },
  };
}

/**
 * Очистить аналитику
 */
export function clearAnalytics(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(ANALYTICS_KEY);
  } catch (error) {
    console.error("Error clearing analytics:", error);
  }
}

/**
 * Получить общую статистику
 */
export function getOverallStats(): {
  functions: ReturnType<typeof getFunctionStats>;
  errors: ReturnType<typeof getErrorStats>;
  api: ReturnType<typeof getApiStats>;
  period: {
    start: number;
    end: number;
  };
} {
  const analytics = getAnalytics();
  const timestamps = analytics.map(e => e.timestamp);
  
  return {
    functions: getFunctionStats(),
    errors: getErrorStats(),
    api: getApiStats(),
    period: {
      start: timestamps.length > 0 ? Math.min(...timestamps) : Date.now(),
      end: timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
    },
  };
}

