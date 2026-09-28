/**
 * llm.ts — Клиент Groq API (CF Workers compatible)
 */

export interface LLMConfig {
  apiKey: string;
  model: string;
}

export interface LLMClient {
  chat(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>): Promise<string>;
}

export function initLLM(config: LLMConfig): LLMClient {
  return {
    async chat(messages) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error ${response.status}: ${err}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || '';
    },
  };
}
