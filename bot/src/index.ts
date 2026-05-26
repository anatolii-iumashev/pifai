import { createBot } from './bot';
import { initLLM } from './llm';
import { initSessionStore } from './session';
import { KNOWLEDGE_BASE, KNOWLEDGE_CHUNKS } from './knowledge';
import { SYSTEM_PROMPT } from './prompts';
import { createRetriever } from './retriever';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  KNOWLEDGE_VERSION?: string;
  KNOWLEDGE_BASE_URL?: string;
  SESSIONS: KVNamespace;
}

let botInstance: ReturnType<typeof createBot> | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET / — info
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('ПиФ бот работает. Используй POST /webhook для Telegram.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // GET /health — health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        hasSecrets: !!env.TELEGRAM_BOT_TOKEN && !!env.GROQ_API_KEY,
        knowledgeVersion: env.KNOWLEDGE_VERSION || '1.0.0',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /webhook — Telegram updates
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        // Lazy init bot
        if (!botInstance) {
          if (!env.TELEGRAM_BOT_TOKEN || !env.GROQ_API_KEY) {
            return new Response('Missing secrets', { status: 500 });
          }
          const llm = initLLM({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || 'llama-3.1-8b-instant' });
          const sessions = initSessionStore(env);
          const retriever = createRetriever(KNOWLEDGE_CHUNKS, env.KNOWLEDGE_BASE_URL);
          botInstance = createBot({
            token: env.TELEGRAM_BOT_TOKEN,
            llm,
            sessions,
            systemPrompt: SYSTEM_PROMPT(KNOWLEDGE_BASE),
            retriever,
          });
        }

        // Parse update body
        const update = await request.json() as any;
        await botInstance.handleUpdate(update);
        return new Response('ok', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('ok', { status: 200 }); // always 200 to stop retries
      }
    }

    // 404
    return new Response('Not found', { status: 404 });
  },
};
