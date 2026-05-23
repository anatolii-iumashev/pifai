/**
 * utils.ts — Вспомогательные функции
 */

/**
 * Простая оценка количества токенов в тексте.
 * Примерно: 1 токен ≈ 4 символа для английского, 1 токен ≈ 2 символа для русского.
 */
export function estimateTokens(text: string): number {
  // Считаем русские символы как ~2 на токен, остальные как ~4
  const russianChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const otherChars = text.length - russianChars;
  return Math.ceil(russianChars / 2 + otherChars / 4);
}

/**
 * Тримминг истории до лимита токенов.
 */
export function trimHistory(
  history: Array<{ role: string; content: string }>,
  maxTokens: number = 8000
): Array<{ role: string; content: string }> {
  let totalTokens = 0;
  const trimmed: Array<{ role: string; content: string }> = [];

  // Идём с конца (самые свежие сообщения)
  for (const msg of [...history].reverse()) {
    const tokens = estimateTokens(msg.content);
    if (totalTokens + tokens > maxTokens) break;
    totalTokens += tokens;
    trimmed.unshift(msg);
  }

  return trimmed;
}

/**
 * Форматирование даты для логов.
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Безопасный парсинг JSON с fallback.
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
