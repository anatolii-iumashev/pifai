import type { ConsultationJob } from '../../edge/src/handler.js';
import type { DialogueStore } from './store.js';
import type { ModelClient } from './openrouter.js';
import type { TelegramClient } from './telegram.js';
import type { KnowledgeChunk } from './retriever.js';
import { search, knowledgeVersion } from './retriever.js';
import { cleanModelText, crisisResponse, isCrisis, unavailableResponse } from './safety.js';

export interface Dependencies {
  store: DialogueStore;
  model: ModelClient;
  telegram: TelegramClient;
  retrieve?: (question: string, previousUser: string) => KnowledgeChunk[];
  log?: (event: Record<string, string | number | undefined>) => void;
}

export function validateJob(input: unknown): ConsultationJob {
  if (!input || typeof input !== 'object') throw new Error('Invalid job');
  const job = input as Record<string, unknown>;
  if (job.schemaVersion !== 1 || !Number.isSafeInteger(job.updateId) || !Number.isSafeInteger(job.chatId)
    || !Number.isSafeInteger(job.messageId) || !Number.isSafeInteger(job.userId)
    || typeof job.text !== 'string' || !job.text.trim() || job.text.length > 4096
    || typeof job.receivedAt !== 'string') throw new Error('Invalid job');
  return job as unknown as ConsultationJob;
}

export async function processConsultation(input: unknown, deps: Dependencies): Promise<{ status: string }> {
  const job = validateJob(input);
  const existing = await deps.store.getOrCreate(job);
  if (existing.status === 'delivered' || existing.status === 'attempted') return { status: existing.status };
  let response = existing.responseText;
  if (existing.status === 'processing') {
    const command = job.text.match(/^\/(start|help|clear)(?:@\w+)?(?:\s|$)/i)?.[1]?.toLowerCase();
    let modelName = 'none';
    let saveHistory = false;
    if (command === 'start') {
      await deps.store.clear(job.chatId);
      response = 'Привет! Я ПиФ, ИИ-помощник по психологии и философии. Могу выслушать и предложить материалы из базы знаний. Расскажи, что тебя волнует? Я не заменяю психолога или врача.';
    } else if (command === 'help') {
      response = 'Напиши вопрос или расскажи о ситуации. /start — начать заново, /help — справка, /clear — удалить историю этого чата. Я ИИ-помощник и не заменяю специалиста.';
    } else if (command === 'clear') {
      await deps.store.clear(job.chatId);
      response = 'История этого чата очищена. Можем начать заново.';
    } else if (isCrisis(job.text)) {
      response = crisisResponse;
    } else {
      const history = await deps.store.history(job.chatId);
      const previousUser = [...history].reverse().find((message) => message.role === 'user')?.content ?? '';
      const sources = (deps.retrieve ?? search)(job.text, previousUser);
      try {
        const answer = await deps.model.answer(job.text, history, sources);
        modelName = answer.model;
        response = cleanModelText(answer.text);
        if (!response) response = unavailableResponse;
        if (sources.length && response !== unavailableResponse) {
          const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
          response += '\n\nМатериалы базы знаний:\n' + unique.map((source) => `${source.title}: ${source.url}`).join('\n');
        }
        deps.log?.({ event: 'model_completed', model: modelName, knowledgeVersion, promptTokens: answer.promptTokens, completionTokens: answer.completionTokens });
      } catch {
        response = unavailableResponse;
        deps.log?.({ event: 'model_failed', knowledgeVersion });
      }
      saveHistory = response !== unavailableResponse;
    }
    await deps.store.saveResult(job, response!, modelName, knowledgeVersion, saveHistory);
  }
  if (!response) throw new Error('Job has no response');
  const claimed = await deps.store.markAttempted(job.updateId);
  if (!claimed) return { status: 'already-attempted' };
  try {
    const ids = await deps.telegram.send(job.chatId, response);
    await deps.store.markDelivered(job.updateId, ids);
    return { status: 'delivered' };
  } catch {
    // The request may have reached Telegram. Replaying it could send a second message.
    deps.log?.({ event: 'delivery_uncertain', updateId: job.updateId });
    return { status: 'delivery-uncertain' };
  }
}
