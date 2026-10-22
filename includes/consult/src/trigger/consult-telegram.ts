import { task } from '@trigger.dev/sdk';
import defaultWikiPack from '../../generated/wiki-pack.json' with { type: 'json' };
import { processConsultation } from '../graph.js';
import { bunnyStore } from '../storage.js';
import { chatModel } from '../model.js';
import { telegramClient } from '../telegram.js';
import type { WikiPack } from '../wiki.js';

export const consultTelegram = task({
  id: 'consult-telegram',
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 2000, maxTimeoutInMs: 10_000, factor: 2 },
  run: async (payload: unknown) => processConsultation(payload, {
    store: bunnyStore(),
    model: chatModel(),
    telegram: telegramClient(process.env.TELEGRAM_BOT_TOKEN ?? ''),
    skill: (defaultWikiPack as WikiPack).skill,
    wiki: defaultWikiPack as WikiPack,
    log: (event) => console.info(JSON.stringify(event)),
  }),
});
