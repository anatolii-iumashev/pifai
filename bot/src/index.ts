import { Hono } from 'hono';
import { createBot, processUserMessage } from './bot';
import { initLLM } from './llm';
import { initSessionStore } from './session';
import { KNOWLEDGE_BASE } from './knowledge';
import { SYSTEM_PROMPT } from './prompts';
import { renderChatPage } from './ui';
import type { LLMClient } from './llm';
import type { SessionStore } from './session';

type KVNamespace = any;

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  KNOWLEDGE_VERSION?: string;
  SESSIONS: KVNamespace;
}

let botInstance: ReturnType<typeof createBot> | null = null;
let llm: LLMClient | null = null;
let sessions: SessionStore | null = null;
const systemPrompt = SYSTEM_PROMPT(KNOWLEDGE_BASE);

function ensureRuntime(env?: Partial<Env>) {
  const runtimeEnv = {
    ...(typeof process !== 'undefined' ? process.env : {}),
    ...env,
  } as Env;

  if (!llm) {
    if (!runtimeEnv.GROQ_API_KEY) {
      throw new Error('Missing GROQ_API_KEY');
    }
    llm = initLLM({ apiKey: runtimeEnv.GROQ_API_KEY, model: runtimeEnv.GROQ_MODEL || 'llama-3.3-70b-versatile' });
  }

  if (!sessions) {
    sessions = initSessionStore(runtimeEnv);
  }

  if (!botInstance) {
    if (!runtimeEnv.TELEGRAM_BOT_TOKEN) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }
    botInstance = createBot({
      token: runtimeEnv.TELEGRAM_BOT_TOKEN,
      llm,
      sessions,
      systemPrompt,
    });
  }

  return { llm, sessions } as { llm: LLMClient; sessions: SessionStore };
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.redirect('/ui'));

app.get('/ui', (c) => c.html(renderChatPage()));

app.get('/health', (c) => {
  const env = c.env;
  return c.json({
    status: 'ok',
    hasSecrets: !!env.TELEGRAM_BOT_TOKEN && !!env.GROQ_API_KEY,
    knowledgeVersion: env.KNOWLEDGE_VERSION || '1.0.0',
  });
});

app.post('/webhook', async (c) => {
  try {
    const env = c.env;
    ensureRuntime(env);
    const update = await c.req.json();
    await botInstance!.handleUpdate(update);
    return c.text('ok');
  } catch (error) {
    console.error('Webhook error:', error);
    return c.text('ok', 200);
  }
});

app.post('/api/chat', async (c) => {
  try {
    const env = c.env;
    const runtime = ensureRuntime(env);
    const body = await c.req.json();
    const message = body?.message;
    const userId = body?.userId ?? 'web';

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Invalid request body: message is required' }, 400);
    }

    const answer = await processUserMessage({
      userId,
      message,
      llm: runtime.llm,
      sessions: runtime.sessions,
      systemPrompt,
    });

    return c.json({ answer });
  } catch (error) {
    console.error('API chat error:', error);
    return c.json({ error: 'Не удалось обработать запрос, попробуйте позже' }, 500);
  }
});

app.all('*', (c) => c.text('Not found', 404));

export default app;
