import type { ConsultationJob } from './types.js';

export interface HistoryMessage { role: 'user' | 'assistant'; content: string }

export interface DialogueStore {
  history(chatId: number): Promise<HistoryMessage[]>;
  saveHistory(chatId: number, userText: string, response: string): Promise<void>;
  clear(chatId: number): Promise<void>;
  /** Claims exclusive delivery for an update: true only when this run owns sending. */
  claimDelivery(updateId: number): Promise<boolean>;
}

const HISTORY_LIMIT = 20;
const DEFAULT_HOST = 'storage.bunnycdn.com';

interface BunnyStorageConfig {
  zone: string;
  accessKey: string;
  host: string;
  prefix: string;
}

function storageConfig(env: NodeJS.ProcessEnv): BunnyStorageConfig {
  if (!env.BUNNY_STORAGE_ZONE || !env.BUNNY_STORAGE_ACCESS_KEY) {
    throw new Error('BUNNY_STORAGE_ZONE and BUNNY_STORAGE_ACCESS_KEY are required');
  }
  return {
    zone: env.BUNNY_STORAGE_ZONE,
    accessKey: env.BUNNY_STORAGE_ACCESS_KEY,
    host: env.BUNNY_STORAGE_HOST ?? DEFAULT_HOST,
    prefix: 'pifai',
  };
}

function url(config: BunnyStorageConfig, path: string): string {
  return `https://${config.host}/${config.zone}/${path.replace(/\/+$/, '')}`;
}

async function getJson(http: typeof fetch, config: BunnyStorageConfig, path: string): Promise<unknown | undefined> {
  const response = await http(url(config, path), {
    method: 'GET',
    headers: { AccessKey: config.accessKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Bunny Storage GET ${path}: HTTP ${response.status}`);
  return JSON.parse(await response.text());
}

async function putObject(http: typeof fetch, config: BunnyStorageConfig, path: string, body: string): Promise<void> {
  const response = await http(url(config, path), {
    method: 'PUT',
    headers: { AccessKey: config.accessKey, 'Content-Type': 'application/octet-stream' },
    body: body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Bunny Storage PUT ${path}: HTTP ${response.status}`);
}

export interface ChatHistory { updatedAt: string; messages: HistoryMessage[] }

export function bunnyStore(env: NodeJS.ProcessEnv = process.env, http: typeof fetch = fetch): DialogueStore {
  const config = storageConfig(env);
  return {
    async history(chatId) {
      const object = await getJson(http, config, `${config.prefix}/chats/${chatId}.json`) as ChatHistory | undefined;
      if (!object || !Array.isArray(object.messages)) return [];
      return object.messages
        .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
        .slice(-HISTORY_LIMIT);
    },
    async saveHistory(chatId, userText, response) {
      const path = `${config.prefix}/chats/${chatId}.json`;
      const object = await getJson(http, config, path) as ChatHistory | undefined;
      const messages = (object && Array.isArray(object.messages) ? object.messages : [])
        .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string');
      messages.push({ role: 'user', content: userText }, { role: 'assistant', content: response });
      await putObject(http, config, path, JSON.stringify({ updatedAt: new Date().toISOString(), messages: messages.slice(-HISTORY_LIMIT) }));
    },
    async clear(chatId) {
      const response = await http(url(config, `${config.prefix}/chats/${chatId}.json`), {
        method: 'DELETE',
        headers: { AccessKey: config.accessKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok && response.status !== 404) throw new Error(`Bunny Storage DELETE ${chatId}: HTTP ${response.status}`);
    },
    async claimDelivery(updateId) {
      const path = `${config.prefix}/delivered/telegram/${updateId}`;
      const existing = await getJson(http, config, path);
      if (existing !== undefined) return false;
      // No conditional writes in Bunny Storage; concurrent duplicates of the same
      // update are serialized by the Trigger.dev idempotency key, so read-then-write is safe here.
      try {
        await putObject(http, config, path, JSON.stringify({ claimedAt: new Date().toISOString() }));
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/HTTP 4\d\d/.test(message)) return false; // already claimed by a concurrent attempt
        throw error;
      }
    },
  };
}
