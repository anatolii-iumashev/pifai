import { ChatOpenAI } from '@langchain/openai';

/**
 * Model access goes through OpenRouter and only from inside the task.
 * Model, fallback, tokens and timeout come from the environment; transient failures are retried by the OpenRouter HTTP layer.
 */
export function chatModel(env: NodeJS.ProcessEnv = process.env): ChatOpenAI {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required');
  if (!env.OPENROUTER_MODEL) throw new Error('OPENROUTER_MODEL is required');
  const fallback = env.OPENROUTER_FALLBACK_MODEL;
  return new ChatOpenAI({
    model: env.OPENROUTER_MODEL,
    apiKey: env.OPENROUTER_API_KEY,
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
    temperature: 0.5,
    maxTokens: Number(env.OPENROUTER_MAX_TOKENS ?? 700),
    timeout: Number(env.OPENROUTER_TIMEOUT_MS ?? 25_000),
    maxRetries: 2,
    ...(fallback ? { modelKwargs: { models: [env.OPENROUTER_MODEL, fallback] } } : {}),
  });
}
