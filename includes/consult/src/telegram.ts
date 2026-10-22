export interface TelegramClient {
  /**
   * Delivers the response as rich messages (headings, lists, tables) in
   * Telegram-sized parts. With editMessageId the first part replaces an earlier
   * placeholder (the thinking ack) by editing it. Telegram 4xx rejections fall
   * back to plain text so a formatting problem never loses the answer.
   */
  send(chatId: number, text: string, editMessageId?: number): Promise<number[]>;
  /** Sends the short thinking comment and returns its message id for later editing. */
  ack(chatId: number, text: string): Promise<number>;
}

/** HTTP answer from the Bot API that names the method, status and description. */
export class TelegramHttpError extends Error {
  constructor(readonly method: string, readonly status: number, readonly description: string) {
    super(`Telegram ${method} failed (${status}): ${description}`);
    this.name = 'TelegramHttpError';
  }
}

export function splitMessage(text: string, max = 3900): string[] {
  const characters = Array.from(text);
  const parts: string[] = [];
  while (characters.length) {
    if (characters.length <= max) { parts.push(characters.join('')); break; }
    let cut = max;
    while (cut > Math.floor(max * 0.7) && characters[cut] !== ' ' && characters[cut] !== '\n') cut--;
    if (cut <= Math.floor(max * 0.7)) cut = max;
    parts.push(characters.splice(0, cut).join('').trim());
    while (characters[0] === ' ' || characters[0] === '\n') characters.shift();
  }
  return parts;
}

// Rich message text limit is 32768 UTF-8 characters; leave headroom for the parser.
const RICH_MAX = 32_000;

export function telegramClient(token: string, http: typeof fetch = fetch): TelegramClient {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
  const call = async (method: string, body: unknown): Promise<number> => {
    const response = await http(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!response.ok || !data.ok || !Number.isSafeInteger(data.result?.message_id)) {
      throw new TelegramHttpError(method, response.status, data.description ?? 'not confirmed');
    }
    return Number(data.result?.message_id);
  };

  const plainPart = (index: number, chatId: number, text: string, editMessageId?: number) => index === 0 && editMessageId
    ? call('editMessageText', { chat_id: chatId, message_id: editMessageId, text, disable_web_page_preview: true })
    : call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });

  return {
    async ack(chatId, text) {
      return call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
    },
    async send(chatId, text, editMessageId) {
      const richParts = splitMessage(text, RICH_MAX);
      const ids: number[] = [];
      let delivered = 0;
      try {
        for (; delivered < richParts.length; delivered++) {
          const rich = { markdown: richParts[delivered] };
          if (delivered === 0 && editMessageId) {
            ids.push(await call('editMessageText', { chat_id: chatId, message_id: editMessageId, rich_message: rich }));
          } else {
            ids.push(await call('sendRichMessage', { chat_id: chatId, rich_message: rich }));
          }
        }
        return ids;
      } catch (error) {
        // A formatting or capability problem is recoverable; a network failure is not
        // (the request may have reached Telegram and a replay could double-send).
        if (!(error instanceof TelegramHttpError) || error.status < 400 || error.status >= 500) throw error;
      }
      // Rich Markdown rejected by Telegram: finish the remaining parts as plain text.
      const plainParts = splitMessage(richParts.slice(delivered).join('\n\n'));
      const editStillPending = ids.length === 0 && Boolean(editMessageId) && delivered === 0;
      for (let index = 0; index < plainParts.length; index++) {
        ids.push(await plainPart(editStillPending ? index : index + 1, chatId, plainParts[index], editMessageId));
      }
      return ids;
    },
  };
}
