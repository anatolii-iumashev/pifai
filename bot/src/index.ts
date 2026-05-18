import { createBot } from './bot';
import { initLLM } from './llm';
import { initSessionStore } from './session';
import { KNOWLEDGE_BASE } from './knowledge';
import { SYSTEM_PROMPT } from './prompts';

// Environment
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Validate required env vars
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY is not set');
  process.exit(1);
}

// Initialize services
const llm = initLLM({ apiKey: GROQ_API_KEY, model: GROQ_MODEL });
const sessions = initSessionStore();
const bot = createBot({
  token: TELEGRAM_BOT_TOKEN,
  llm,
  sessions,
  systemPrompt: SYSTEM_PROMPT(KNOWLEDGE_BASE),
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Launch bot (long polling — no tunnel needed)
bot.telegram.deleteWebhook().then(() => {
  bot.launch().then(() => {
    console.log('🦊 ПиФ бот запущен!');
    console.log('   Режим: long polling');
    console.log('   Напиши боту в Telegram — он ответит');
  });
});
