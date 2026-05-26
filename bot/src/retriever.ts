/**
 * retriever.ts — Поиск по wiki-страницам и обогащение контекста LLM
 *
 * Использует предвычисленный индекс (ключевые слова + chunks),
 * чтобы на каждый запрос пользователя находить релевантные статьи
 * из базы знаний и подставлять их с цитируемым источником.
 */

export interface WikiChunk {
  /** Уникальный ID: sourcePath#section */
  id: string;
  /** Заголовок страницы */
  title: string;
  /** Относительный путь от src/content/docs/, напр. "authors/jung/archetypes-shadow-basics.md" */
  sourcePath: string;
  /** Название секции (## heading) */
  section: string;
  /** Текст секции */
  text: string;
  /** Предвычисленные ключевые слова для поиска */
  keywords: string[];
}

export interface RetrievedChunk {
  title: string;
  sourcePath: string;
  section: string;
  text: string;
}

/** Retriever interface — поиск по wiki-страницам */
export interface Retriever {
  retrieve(query: string, topK?: number): RetrievedChunk[];
  formatContext(entries: RetrievedChunk[]): string;
  /** Конвертирует wiki-путь в URL базы знаний */
  sourceUrl(sourcePath: string): string;
}

/**
 * Конвертирует относительный путь из src/content/docs/ в URL базы знаний.
 *
 * Примеры:
 *   "authors/jung/shadow.md" → "/authors/jung/shadow/"
 *   "practices/shadow-work.md" → "/practices/shadow-work/"
 *   "basics/emotions-and-needs.md" → "/basics/emotions-and-needs/"
 */
function wikiPathToUrl(sourcePath: string): string {
  // Убираем .md, превращаем в directory-style URL
  return '/' + sourcePath.replace(/\.md$/, '') + '/';
}

// Стоп-слова (русские + английские)
const STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
  'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за',
  'бы', 'по', 'из', 'об', 'от', 'этот', 'эта', 'эти', 'о', 'для', 'или',
  'уже', 'нет', 'если', 'когда', 'тебя', 'меня', 'его', 'её', 'их', 'нас',
  'вас', 'себя', 'кто', 'что', 'том', 'тем', 'там', 'тут', 'здесь',
  'весь', 'сам', 'сама', 'сами', 'само', 'самом', 'самой', 'самих',
  'может', 'можно', 'нужно', 'надо', 'чтобы', 'также', 'потому', 'поэтому',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'this', 'that', 'these', 'those', 'not', 'no',
]);

function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[а-яёa-z]+/gi) || [];
  return [...new Set(words.filter(w => w.length > 2 && !STOPWORDS.has(w)))];
}

/**
 * Создаёт retriever, который ищет по предвычисленному индексу WikiChunk[].
 * @param chunks - чанки для поиска
 * @param baseUrl - базовый URL базы знаний (без слеша на конце), напр. "https://anatolii-iumashev.github.io/pifai"
 */
export function createRetriever(chunks: WikiChunk[], baseUrl: string = 'https://anatolii-iumashev.github.io/pifai'): Retriever {
  return {
    /**
     * Находит topK релевантных chunks по запросу.
     * Использует Jaccard-подобное пересечение ключевых слов.
     */
    retrieve(query: string, topK: number = 3): RetrievedChunk[] {
      const queryTokens = tokenize(query);
      if (queryTokens.length === 0) return [];

      const scored = chunks.map(chunk => {
        const overlap = queryTokens.filter(t => chunk.keywords.includes(t)).length;
        const union = new Set([...queryTokens, ...chunk.keywords]);
        const score = union.size > 0 ? overlap / union.size : 0;
        return { chunk, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(c => c.score > 0)
        .map(c => ({
          title: c.chunk.title,
          sourcePath: c.chunk.sourcePath,
          section: c.chunk.section,
          text: c.chunk.text,
        }));
    },

    /**
     * Преобразует wiki-путь в полный URL базы знаний.
     */
    sourceUrl(sourcePath: string): string {
      return `${baseUrl}${wikiPathToUrl(sourcePath)}`;
    },

    /**
     * Форматирует найденные chunks для вставки в контекст LLM.
     * Каждый chunk обрамляется в блок с указанием источника как URL.
     */
    formatContext(entries: RetrievedChunk[]): string {
      if (entries.length === 0) return '';

      return entries.map((e, i) => {
        const url = `${baseUrl}${wikiPathToUrl(e.sourcePath)}`;
        return `[Источник ${i + 1}]: ${e.title} → ${url}
> ${e.section ? `*${e.section}*` : ''}
>
${e.text.split('\n').map(line => `> ${line}`).join('\n')}`;
      }).join('\n\n---\n\n');
    },
  };
}