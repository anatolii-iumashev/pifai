export interface EdgeConfig {
  webhookSecret: string;
  triggerSecretKey: string;
  triggerApiUrl?: string;
}

export interface ConsultationJob {
  schemaVersion: 1;
  updateId: number;
  chatId: number;
  messageId: number;
  userId: number;
  text: string;
  receivedAt: string;
}

const MAX_BODY_BYTES = 16 * 1024;

async function readLimited(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty-body');
  const pieces: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error('body-too-large');
      pieces.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const piece of pieces) { all.set(piece, offset); offset += piece.length; }
  return new TextDecoder().decode(all);
}

function jobFromUpdate(data: unknown): ConsultationJob | null {
  if (!data || typeof data !== 'object') throw new Error('invalid-update');
  const update = data as Record<string, unknown>;
  if (!Number.isSafeInteger(update.update_id) || Number(update.update_id) < 0) throw new Error('invalid-update-id');
  if (!update.message || typeof update.message !== 'object') return null;
  const message = update.message as Record<string, unknown>;
  const chat = message.chat as Record<string, unknown> | undefined;
  const from = message.from as Record<string, unknown> | undefined;
  if (chat?.type !== 'private') return null;
  if (!Number.isSafeInteger(chat.id) || !Number.isSafeInteger(from?.id) || !Number.isSafeInteger(message.message_id)) {
    throw new Error('invalid-message');
  }
  if (typeof message.text !== 'string') return null;
  const text = message.text.trim();
  if (!text || text.length > 4096) throw new Error('invalid-text');
  return {
    schemaVersion: 1,
    updateId: Number(update.update_id),
    chatId: Number(chat.id),
    messageId: Number(message.message_id),
    userId: Number(from?.id),
    text,
    receivedAt: new Date().toISOString(),
  };
}

export async function handleRequest(request: Request, config: EdgeConfig, http: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') {
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (url.pathname !== '/webhook') return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  if (!config.webhookSecret || !config.triggerSecretKey) return new Response('Unavailable', { status: 503 });
  if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== config.webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  const declaredSize = Number(request.headers.get('content-length'));
  if (declaredSize > MAX_BODY_BYTES) return new Response('Payload too large', { status: 413 });

  let job: ConsultationJob | null;
  try {
    job = jobFromUpdate(JSON.parse(await readLimited(request)));
  } catch (error) {
    return new Response(error instanceof Error && error.message === 'body-too-large' ? 'Payload too large' : 'Invalid payload', {
      status: error instanceof Error && error.message === 'body-too-large' ? 413 : 400,
    });
  }
  if (!job) return new Response('Ignored', { status: 200 });

  try {
    const apiUrl = config.triggerApiUrl ?? 'https://api.trigger.dev';
    const response = await http(`${apiUrl}/api/v1/tasks/consult-telegram/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.triggerSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: job,
        options: {
          idempotencyKey: `pifai:tg:${job.updateId}`,
          idempotencyKeyTTL: '7d',
          concurrencyKey: String(job.chatId),
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return new Response('Queue unavailable', { status: 503 });
    const handle = await response.json() as { id?: unknown };
    if (typeof handle.id !== 'string' || !handle.id) return new Response('Queue unavailable', { status: 503 });
    return new Response('Accepted', { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('Queue unavailable', { status: 503 });
  }
}
