export interface TelegramClient {
  /**
   * Delivers the response in Telegram-sized parts. With editMessageId the first
   * part replaces an earlier placeholder (the thinking ack) by editing it.
   */
  send(chatId: number, text: string, editMessageId?: number): Promise<number[]>;
  /** Sends the short thinking comment and returns its message id for later editing. */
  ack(chatId: number, text: string): Promise<number>;
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

export function telegramClient(token: string, http: typeof fetch = fetch): TelegramClient {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
  const call = async (method: string, body: unknown): Promise<{ ok: true; messageId: number }> => {
    const response = await http(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Telegram ${method} failed (${response.status})`);
    const data = await response.json() as { ok?: boolean; result?: { message_id?: number } };
    if (!data.ok || !Number.isSafeInteger(data.result?.message_id)) throw new Error(`Telegram ${method} not confirmed`);
    return { ok: true, messageId: Number(data.result?.message_id) };
  };

  return {
    async ack(chatId, text) {
      return (await call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })).messageId;
    },
    async send(chatId, text, editMessageId) {
      const parts = splitMessage(text);
      const ids: number[] = [];
      let offset = 0;
      if (editMessageId) {
        const edited = await call('editMessageText', {
          chat_id: chatId, message_id: editMessageId, text: parts[0], disable_web_page_preview: true,
        });
        ids.push(edited.messageId);
        offset = 1;
      }
      for (const part of parts.slice(offset)) {
        ids.push((await call('sendMessage', { chat_id: chatId, text: part, disable_web_page_preview: true })).messageId);
      }
      return ids;
    },
  };
}
