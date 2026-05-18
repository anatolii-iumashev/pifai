/**
 * bot.ts — Обработчики Telegram
 */

import { Telegraf } from 'telegraf';
import type { LLMClient } from './llm';
import type { SessionStore } from './session';
import { HELP_TEXT, START_TEXT, CRISIS_RESPONSE } from './prompts';

export interface BotConfig {
  token: string;
  llm: LLMClient;
  sessions: SessionStore;
  systemPrompt: string;
}

export function createBot(config: BotConfig) {
  const bot = new Telegraf(config.token);

  // /start — приветствие
  bot.start(async (ctx) => {
    await config.sessions.clear(ctx.from.id);
    await ctx.reply(START_TEXT);
  });

  // /help — справка
  bot.help(async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });

  // /clear — сброс истории
  bot.command('clear', async (ctx) => {
    await config.sessions.clear(ctx.from.id);
    await ctx.reply('История диалога очищена. Начнём заново?');
  });

  // Текстовые сообщения — основной диалог
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    // Показываем индикатор печатания
    await ctx.sendChatAction('typing');

    try {
      // Получаем историю
      const history = await config.sessions.get(userId);

      // Собираем сообщения для LLM
      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        { role: 'system', content: config.systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];

      // Отправляем запрос к LLM
      const response = await config.llm.chat(messages);

      // Сохраняем в историю
      await config.sessions.add(userId, {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });
      await config.sessions.add(userId, {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });

      // Отправляем ответ
      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Bot error:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуй ещё раз позже.');
    }
  });

  return bot;
}
