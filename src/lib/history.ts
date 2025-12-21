// Утилита для работы с историей запросов

export type HistoryItem = {
  id: string;
  url: string;
  mode: "about" | "thesis" | "telegram" | "translate" | "illustration";
  result: string | null;
  imageResult: string | null;
  timestamp: number;
  language: "ru" | "me";
};

const HISTORY_KEY = "article_processor_history";
const MAX_HISTORY_ITEMS = 20;

/**
 * Получить всю историю запросов
 */
export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    
    const history = JSON.parse(stored) as HistoryItem[];
    // Сортируем по дате (новые первыми)
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Error reading history:", error);
    return [];
  }
}

/**
 * Оценить размер записи истории
 */
function estimateHistoryItemSize(item: HistoryItem): number {
  try {
    return new Blob([JSON.stringify(item)]).size;
  } catch {
    return JSON.stringify(item).length * 2;
  }
}

/**
 * Добавить запись в историю
 */
export function addToHistory(item: Omit<HistoryItem, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  
  try {
    const history = getHistory();
    
    // ВАЖНО: Не сохраняем изображения в историю - они слишком большие
    // Сохраняем только флаг, что изображение было сгенерировано
    const historyItem: HistoryItem = {
      ...item,
      imageResult: item.imageResult ? "[IMAGE]" : null, // Заменяем изображение на флаг
      result: item.result ? item.result.substring(0, 5000) : null, // Ограничиваем длину текста
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    // Добавляем в начало
    history.unshift(historyItem);
    
    // Ограничиваем количество записей
    let limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    
    // Проверяем размер и удаляем самые старые, если нужно
    try {
      const totalSize = estimateHistoryItemSize(limitedHistory as any);
      const MAX_HISTORY_SIZE = 5 * 1024 * 1024; // 5 МБ максимум
      
      if (totalSize > MAX_HISTORY_SIZE) {
        // Удаляем самые старые записи, пока размер не станет приемлемым
        limitedHistory = limitedHistory.sort((a, b) => b.timestamp - a.timestamp);
        while (limitedHistory.length > 0 && estimateHistoryItemSize(limitedHistory as any) > MAX_HISTORY_SIZE) {
          limitedHistory.pop(); // Удаляем самую старую
        }
        console.warn(`History too large, reduced to ${limitedHistory.length} items`);
      }
    } catch (sizeError) {
      // Если не удалось оценить размер, просто ограничиваем количеством
      limitedHistory = limitedHistory.slice(0, MAX_HISTORY_ITEMS);
    }
    
    // Сохраняем
    localStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error("Error saving to history:", error);
    
    // Если переполнение, пытаемся очистить старые записи
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("History quota exceeded, clearing oldest entries...");
      try {
        const history = getHistory();
        // Удаляем половину самых старых записей
        const sorted = history.sort((a, b) => b.timestamp - a.timestamp);
        const reduced = sorted.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(reduced));
        
        // Пробуем добавить новую запись еще раз
        const historyItem: HistoryItem = {
          ...item,
          imageResult: item.imageResult ? "[IMAGE]" : null,
          result: item.result ? item.result.substring(0, 5000) : null,
          id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };
        const updated = [historyItem, ...reduced].slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch (retryError) {
        console.error("Failed to save to history after cleanup:", retryError);
      }
    }
  }
}

/**
 * Удалить запись из истории
 */
export function removeFromHistory(id: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const history = getHistory();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing from history:", error);
  }
}

/**
 * Очистить всю историю
 */
export function clearHistory(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error("Error clearing history:", error);
  }
}

/**
 * Получить запись по ID
 */
export function getHistoryItem(id: string): HistoryItem | null {
  const history = getHistory();
  return history.find(item => item.id === id) || null;
}

/**
 * Форматировать дату для отображения
 */
export function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

