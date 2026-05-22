/**
 * bot.ts — Обработчики Telegram
 */

import { Telegraf } from 'telegraf';
import type { LLMClient } from './llm';
import type { SessionStore } from './session';
import { HELP_TEXT, START_TEXT } from './prompts';

export interface BotConfig {
  token: string;
  llm: LLMClient;
  sessions: SessionStore;
  systemPrompt: string;
}

export interface ProcessMessageParams {
  userId: string | number;
  message: string;
  llm: LLMClient;
  sessions: SessionStore;
  systemPrompt: string;
}

export async function processUserMessage(params: ProcessMessageParams): Promise<string> {
  const { userId, message, llm, sessions, systemPrompt } = params;

  const history = await sessions.get(userId);
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const response = await llm.chat(messages);

  await sessions.add(userId, {
    role: 'user',
    content: message,
    timestamp: Date.now(),
  });
  await sessions.add(userId, {
    role: 'assistant',
    content: response,
    timestamp: Date.now(),
  });

  return response;
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

    await ctx.sendChatAction('typing');

    try {
      const response = await processUserMessage({
        userId,
        message: userMessage,
        llm: config.llm,
        sessions: config.sessions,
        systemPrompt: config.systemPrompt,
      });

      await ctx.reply(response, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Bot error:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуй ещё раз позже.');
    }
  });

  return bot;
}
