/**
 * bot.ts — Обработчики Telegram
 */

import { Telegraf } from 'telegraf';
import type { LLMClient } from './llm';
import type { SessionStore } from './session';
import type { Retriever } from './retriever';
import { HELP_TEXT, START_TEXT, CRISIS_RESPONSE } from './prompts';

export interface BotConfig {
  token: string;
  llm: LLMClient;
  sessions: SessionStore;
  systemPrompt: string;
  retriever: Retriever;
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

      // Ищем релевантные статьи из базы знаний
      const relevant = config.retriever.retrieve(userMessage, 2);
      const knowledgeContext = config.retriever.formatContext(relevant);

      // Собираем сообщения для LLM
      const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        { role: 'system', content: config.systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ];

      // Добавляем вопрос с контекстом (одним сообщением)
      const userContent = knowledgeContext
        ? `Найденные статьи (цитируй их):\n\n${knowledgeContext}\n\nВопрос пользователя: ${userMessage}`
        : userMessage;
      messages.push({ role: 'user', content: userContent });

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
    } catch (error: any) {
      console.error('Bot error:', error);

      // Проверяем, не ошибка ли это "Request too large" (история накопилась)
      const errMsg = error?.message || error?.toString() || '';
      if (errMsg.includes('Request too large') || errMsg.includes('rate_limit_exceeded')) {
        await ctx.reply(
          '💬 Похоже, история нашего диалога стала слишком большой для обработки. ' +
          'Напиши /clear, чтобы очистить историю, и я смогу ответить на твой вопрос.'
        );
      } else {
        await ctx.reply('Произошла ошибка. Пожалуйста, попробуй ещё раз позже.');
      }
    }
  });

  return bot;
}
