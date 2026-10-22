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
const MAX_TEXT_LENGTH = 4096;

export { MAX_BODY_BYTES };

export async function readLimited(request: Request): Promise<string> {
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

export function jobFromUpdate(data: unknown): ConsultationJob | null {
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
  if (!text || text.length > MAX_TEXT_LENGTH) throw new Error('invalid-text');
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
