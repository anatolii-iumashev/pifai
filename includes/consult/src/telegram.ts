export interface TelegramClient { send(chatId: number, text: string): Promise<number[]> }

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
  return {
    async send(chatId, text) {
      const ids: number[] = [];
      for (const part of splitMessage(text)) {
        const response = await http(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: part, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Telegram send failed (${response.status})`);
        const data = await response.json() as { ok?: boolean; result?: { message_id?: number } };
        if (!data.ok || !Number.isSafeInteger(data.result?.message_id)) throw new Error('Telegram send not confirmed');
        ids.push(Number(data.result?.message_id));
      }
      return ids;
    },
  };
}
