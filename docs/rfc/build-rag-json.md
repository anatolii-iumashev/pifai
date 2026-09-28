# как альтернатива для Wiki LLM

### Как это обычно делают с Astro + Starlight

1. **Источники данных**  
   У тебя уже есть Content Collections (md/mdx + yaml). Всё это доступно через `getCollection()` / `getEntry()` во время билда.

2. **Генерация артефактов на билде**  
   Самые чистые способы:
   - **Astro Endpoint** (рекомендую):

     ```ts
     // src/pages/rag-index.json.ts
     import { getCollection } from 'astro:content';
     import { Markdown } from 'astro'; // или свой парсер

     export async function GET() {
       const docs = await getCollection('docs'); // или как у тебя называется
       const chunks = [];

       for (const doc of docs) {
         // 1. Рендерим body в plain text / markdown
         // 2. Делаем chunking (по заголовкам, по параграфам, RecursiveCharacterTextSplitter и т.д.)
         // 3. Добавляем метаданные
         chunks.push({
           id: `${doc.id}#chunk-0`,
           slug: doc.slug,
           title: doc.data.title,
           content: '...',          // текст чанка
           // embedding?: number[], // если хочешь считать на билде
           metadata: { ... }
         });
       }

       return new Response(JSON.stringify(chunks), {
         headers: { 'Content-Type': 'application/json' }
       });
     }
     ```

     После `astro build` файл появляется в `dist/rag-index.json`.

   - **Интеграция Astro** или хук `astro:build:done` — то же самое, но можно писать файл прямо в `dist/` или в отдельную папку.

   - Отдельный скрипт `node scripts/build-rag.js`, который запускается после `astro build` (или параллельно через `npm-run-all`).

3. **Что именно генерировать**

   | Вариант                             | Плюсы                                                        | Минусы                                                    |
   | ----------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
   | Только JSON с чанками + метаданные  | Просто, быстро, размер маленький                             | Эмбеддинги считает бот при старте                         |
   | JSON + precomputed embeddings       | Бот стартует мгновенно, нет повторных расходов на эмбеддинги | JSON сильно раздувается (особенно text-embedding-3-large) |
   | FAISS / HNSW индекс + docstore.json | Максимальная скорость поиска                                 | Нужно уметь сериализовать/загружать индекс в Python/JS    |

   Для Telegram-бота на LangChain чаще всего достаточно **первого или второго варианта**.

4. **Как бот это использует**

   ```python
   # при старте бота
   with open("rag-index.json") as f:
       data = json.load(f)

   docs = [Document(page_content=c["content"], metadata=c) for c in data]
   vectorstore = FAISS.from_documents(docs, embeddings)  # или MemoryVectorStore
   # дальше обычный RAG-ретривер
   ```

   Или, если эмбеддинги уже посчитаны:

   ```python
   # создаёшь FAISS из готовых векторов + текстов
   ```

### Сравнение с текущим «wiki llm Карпаты»

Подход Карпаты (весь текст в контекст / большой prompt) хорошо работает, пока база маленькая.  
RAG на билде даёт:

- масштабируемость (можно держать сотни/тысячи статей);
- точные ссылки на источники;
- меньше галлюцинаций на длинных ответах;
- возможность комбинировать с Pagefind-индексом Starlight (если хочешь гибридный поиск).

### Практические советы именно под твой стек

- YAML-цитаты тоже положи в отдельную коллекцию или просто прочитай файлы через `fs` в endpoint’е.
- Chunking лучше делать по `#`/`##` заголовкам + небольшой overlap — так бот будет давать более точные цитаты.
- Если контент обновляется редко — считай эмбеддинги на билде (OpenAI / local sentence-transformers / bge). Если часто — оставляй только текст.
- Можно положить `rag-index.json` в `public/` или в отдельный артефакт CI, который потом копируется к боту.
- Есть готовые штуки вроде `astro-llm` (генерирует llm.txt / контекст для RAG после билда).

### Итог

Да — **RAG в виде JSON, собираемый во время билда Astro — нормальный и распространённый паттерн**.  
Он отлично стыкуется с Content Collections + Starlight и с LangChain-ботом.  
Самый простой старт: endpoint `rag-index.json.ts` → чанки + метаданные → бот загружает JSON при старте и строит векторный индекс.
