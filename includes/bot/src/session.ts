/**
 * session.ts — История чатов через Cloudflare KV
 */

const MAX_HISTORY = 20;

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionStore {
  get(userId: number): Promise<SessionMessage[]>;
  add(userId: number, message: SessionMessage): Promise<void>;
  clear(userId: number): Promise<void>;
}

export function initSessionStore(env: { SESSIONS?: KVNamespace }): SessionStore {
  const kv = env.SESSIONS;

  return {
    async get(userId: number): Promise<SessionMessage[]> {
      if (!kv) return [];
      try {
        const raw = await kv.get(`session:${userId}`, 'text');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },

    async add(userId: number, message: SessionMessage): Promise<void> {
      if (!kv) return;
      const history = await this.get(userId);
      history.push(message);
      const trimmed = history.slice(-MAX_HISTORY);
      await kv.put(`session:${userId}`, JSON.stringify(trimmed), {
        expirationTtl: 86400 * 7,
      });
    },

    async clear(userId: number): Promise<void> {
      if (!kv) return;
      await kv.delete(`session:${userId}`);
    },
  };
}
