import { task } from '@trigger.dev/sdk';
import { processConsultation } from '../processor.js';
import { postgresStore } from '../store.js';
import { openRouterClient } from '../openrouter.js';
import { telegramClient } from '../telegram.js';

export const consultTelegram = task({
  id: 'consult-telegram',
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 2000, maxTimeoutInMs: 10_000, factor: 2 },
  run: async (payload: unknown) => processConsultation(payload, {
    store: postgresStore(),
    model: openRouterClient(),
    telegram: telegramClient(process.env.TELEGRAM_BOT_TOKEN ?? ''),
    log: (event) => console.info(JSON.stringify(event)),
  }),
});
