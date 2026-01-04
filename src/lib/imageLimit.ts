// Система лимитов для генерации изображений

const IMAGE_LIMIT_KEY = "image_generation_limit";
const MAX_IMAGES_PER_DAY = 3;

export type ImageLimitData = {
  count: number;
  date: string; // YYYY-MM-DD
};

/**
 * Получить текущую дату в формате YYYY-MM-DD
 */
function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Получить данные о лимите
 */
export function getImageLimit(): ImageLimitData {
  if (typeof window === "undefined") {
    return { count: 0, date: getCurrentDate() };
  }

  try {
    const stored = localStorage.getItem(IMAGE_LIMIT_KEY);
    if (!stored) {
      return { count: 0, date: getCurrentDate() };
    }

    const data: ImageLimitData = JSON.parse(stored);
    const currentDate = getCurrentDate();

    // Если дата изменилась, сбрасываем счетчик
    if (data.date !== currentDate) {
      return { count: 0, date: currentDate };
    }

    return data;
  } catch (error) {
    console.error("Error reading image limit:", error);
    return { count: 0, date: getCurrentDate() };
  }
}

/**
 * Проверить, можно ли создать изображение
 */
export function canGenerateImage(): boolean {
  const limit = getImageLimit();
  return limit.count < MAX_IMAGES_PER_DAY;
}

/**
 * Получить количество оставшихся генераций
 */
export function getRemainingGenerations(): number {
  const limit = getImageLimit();
  return Math.max(0, MAX_IMAGES_PER_DAY - limit.count);
}

/**
 * Увеличить счетчик генераций
 */
export function incrementImageCount(): void {
  if (typeof window === "undefined") return;

  try {
    const limit = getImageLimit();
    const newData: ImageLimitData = {
      count: limit.count + 1,
      date: getCurrentDate(),
    };

    localStorage.setItem(IMAGE_LIMIT_KEY, JSON.stringify(newData));
  } catch (error) {
    console.error("Error incrementing image count:", error);
  }
}

/**
 * Сбросить счетчик (для тестирования)
 */
export function resetImageLimit(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(IMAGE_LIMIT_KEY);
  } catch (error) {
    console.error("Error resetting image limit:", error);
  }
}

