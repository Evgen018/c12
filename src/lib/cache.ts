// Система кэширования для обработанных статей

export type CacheKey = string;
export type CacheEntry<T> = {
  data: T;
  timestamp: number;
  expiresAt: number;
};

// Время жизни кэша (в миллисекундах)
const CACHE_DURATION = {
  // Кэш парсинга статей - 24 часа
  parse: 24 * 60 * 60 * 1000,
  // Кэш AI обработки - 7 дней (результаты стабильны)
  ai: 7 * 24 * 60 * 60 * 1000,
  // Кэш переводов - 7 дней
  translate: 7 * 24 * 60 * 60 * 1000,
  // Кэш изображений - 30 дней (изображения не меняются)
  image: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Генерация ключа кэша
 */
export function generateCacheKey(
  url: string,
  mode?: string,
  language?: string,
  additionalParams?: Record<string, string>
): CacheKey {
  const parts = [url, mode || "", language || ""];
  
  if (additionalParams) {
    const sortedParams = Object.keys(additionalParams)
      .sort()
      .map(key => `${key}:${additionalParams[key]}`)
      .join("|");
    parts.push(sortedParams);
  }
  
  return `cache_${btoa(parts.join("|")).replace(/[+/=]/g, "")}`;
}

/**
 * Получить данные из кэша
 */
export function getFromCache<T>(key: CacheKey, cacheType: keyof typeof CACHE_DURATION): T | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const entry: CacheEntry<T> = JSON.parse(stored);
    const now = Date.now();
    
    // Проверяем срок действия
    if (now > entry.expiresAt) {
      // Удаляем устаревший кэш
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch (error) {
    console.error("Error reading from cache:", error);
    return null;
  }
}

/**
 * Оценить размер данных в байтах
 */
function estimateSize(data: any): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length * 2; // Примерная оценка
  }
}

/**
 * Сохранить данные в кэш
 */
export function saveToCache<T>(
  key: CacheKey,
  data: T,
  cacheType: keyof typeof CACHE_DURATION
): void {
  if (typeof window === "undefined") return;
  
  try {
    // Проверяем размер данных перед сохранением
    const estimatedSize = estimateSize(data);
    const MAX_ENTRY_SIZE = 2 * 1024 * 1024; // 2 МБ максимум на запись
    
    // Если данные слишком большие (особенно изображения), не кэшируем
    if (estimatedSize > MAX_ENTRY_SIZE) {
      console.warn(`Cache entry too large (${(estimatedSize / 1024 / 1024).toFixed(2)} MB), skipping cache for ${cacheType}`);
      return;
    }
    
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + CACHE_DURATION[cacheType],
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error("Error saving to cache:", error);
    // Если localStorage переполнен, пытаемся очистить старые записи
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("localStorage quota exceeded, clearing old cache entries...");
      clearExpiredCache();
      
      // Если все еще не помещается, удаляем самые старые записи
      try {
        const stats = getCacheStats();
        if (stats.total > 0) {
          // Удаляем половину самых старых записей
          clearOldestCacheEntries(Math.floor(stats.total / 2));
        }
        
        // Пробуем еще раз
        const now = Date.now();
        const entry: CacheEntry<T> = {
          data,
          timestamp: now,
          expiresAt: now + CACHE_DURATION[cacheType],
        };
        localStorage.setItem(key, JSON.stringify(entry));
      } catch (retryError) {
        console.error("Failed to save to cache after cleanup:", retryError);
        // Если все еще не работает, просто не сохраняем (не критично)
      }
    }
  }
}

/**
 * Очистить устаревшие записи кэша
 */
export function clearExpiredCache(): void {
  if (typeof window === "undefined") return;
  
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    let cleared = 0;
    
    for (const key of keys) {
      if (key.startsWith("cache_")) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const entry: CacheEntry<any> = JSON.parse(stored);
            if (now > entry.expiresAt) {
              localStorage.removeItem(key);
              cleared++;
            }
          }
        } catch (error) {
          // Удаляем поврежденные записи
          localStorage.removeItem(key);
          cleared++;
        }
      }
    }
    
    if (cleared > 0) {
      console.log(`Cleared ${cleared} expired cache entries`);
    }
  } catch (error) {
    console.error("Error clearing expired cache:", error);
  }
}

/**
 * Очистить самые старые записи кэша
 */
export function clearOldestCacheEntries(count: number): void {
  if (typeof window === "undefined") return;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheEntries: Array<{ key: string; timestamp: number }> = [];
    
    for (const key of keys) {
      if (key.startsWith("cache_")) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const entry: CacheEntry<any> = JSON.parse(stored);
            cacheEntries.push({ key, timestamp: entry.timestamp });
          }
        } catch {
          // Удаляем поврежденные записи
          localStorage.removeItem(key);
        }
      }
    }
    
    // Сортируем по времени (старые первыми)
    cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Удаляем самые старые
    let cleared = 0;
    for (let i = 0; i < Math.min(count, cacheEntries.length); i++) {
      localStorage.removeItem(cacheEntries[i].key);
      cleared++;
    }
    
    if (cleared > 0) {
      console.log(`Cleared ${cleared} oldest cache entries`);
    }
  } catch (error) {
    console.error("Error clearing oldest cache entries:", error);
  }
}

/**
 * Очистить весь кэш
 */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  
  try {
    const keys = Object.keys(localStorage);
    let cleared = 0;
    
    for (const key of keys) {
      if (key.startsWith("cache_")) {
        localStorage.removeItem(key);
        cleared++;
      }
    }
    
    console.log(`Cleared ${cleared} cache entries`);
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}

/**
 * Получить статистику кэша
 */
export function getCacheStats(): {
  total: number;
  byType: Record<string, number>;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  if (typeof window === "undefined") {
    return { total: 0, byType: {}, totalSize: 0, oldestEntry: null, newestEntry: null };
  }
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith("cache_"));
    const now = Date.now();
    
    let totalSize = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    const byType: Record<string, number> = {};
    
    for (const key of cacheKeys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          totalSize += stored.length;
          const entry: CacheEntry<any> = JSON.parse(stored);
          
          if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
            oldestTimestamp = entry.timestamp;
          }
          if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
            newestTimestamp = entry.timestamp;
          }
          
          // Определяем тип по ключу (упрощенно)
          const type = key.includes("_parse") ? "parse" :
                      key.includes("_ai") ? "ai" :
                      key.includes("_translate") ? "translate" :
                      key.includes("_image") ? "image" : "unknown";
          
          byType[type] = (byType[type] || 0) + 1;
        }
      } catch (error) {
        // Пропускаем поврежденные записи
      }
    }
    
    return {
      total: cacheKeys.length,
      byType,
      totalSize,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return { total: 0, byType: {}, totalSize: 0, oldestEntry: null, newestEntry: null };
  }
}

