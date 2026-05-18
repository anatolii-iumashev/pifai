/**
 * llm.ts — Клиент Groq API
 */

import Groq from 'groq-sdk';

export interface LLMConfig {
  apiKey: string;
  model: string;
}

export interface LLMClient {
  chat(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>): Promise<string>;
  chatStream(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onChunk: (chunk: string) => void,
  ): Promise<string>;
}

export function initLLM(config: LLMConfig): LLMClient {
  const groq = new Groq({ apiKey: config.apiKey });

  return {
    async chat(messages) {
      const completion = await groq.chat.completions.create({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      });

      return completion.choices[0]?.message?.content || '';
    },

    async chatStream(messages, onChunk) {
      const stream = await groq.chat.completions.create({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        onChunk(content);
      }

      return fullContent;
    },
  };
}
