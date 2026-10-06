/**
 * test-rag.mjs — тест RAG: ретривер + LLM
 *
 * Запуск: node test-rag.mjs
 * Проверяет, что бот цитирует источники из базы знаний.
 */

// Имитируем то, что делает bot.ts
async function test() {
  // 1. Загружаем базу знаний и ретривер
  const { KNOWLEDGE_BASE, KNOWLEDGE_CHUNKS } = await import('./src/knowledge.ts');
  const { createRetriever } = await import('./src/retriever.ts');
  const baseUrl = process.env.KNOWLEDGE_BASE_URL || 'https://anatolii-iumashev.github.io/pifai';
  const retriever = createRetriever(KNOWLEDGE_CHUNKS, baseUrl);

  // 2. Тестовый вопрос
  const query = 'Что такое тень в юнгианской психологии?';
  console.log('Вопрос:', query);
  console.log();

  // 3. Ищем релевантные статьи
  const relevant = retriever.retrieve(query, 3);
  const context = retriever.formatContext(relevant);
  console.log('=== НАЙДЕННЫЕ ИСТОЧНИКИ ===');
  console.log(context);
  console.log();

  // 4. Собираем prompt как в bot.ts
  const userPart = context
    ? `Найденные статьи из базы знаний (используй их для ответа, цитируй источники):\n\n${context}\n\nТеперь ответь пользователю с учётом этой информации.`
    : '';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `Ты — ПиФ, эмпатичный интегративный психотерапевт.
При ответе ОБЯЗАТЕЛЬНО цитируй источники в формате:
> «цитата»
> — [Название статьи](src/content/docs/путь/к/странице.md)

Если пересказываешь своими словами — всё равно укажи:
> — Источник: [Название статьи](src/content/docs/путь/к/странице.md)` },
        { role: 'user', content: userPart },
        { role: 'user', content: query },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('API Error:', err);
    return;
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content || '';
  console.log('=== ОТВЕТ БОТА ===');
  console.log(answer);
}

test().catch(console.error);