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
      let lastError: Error | null = null;

      // Retry up to 3 times with backoff
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          // Wait before retry: 1s, 3s, 7s
          await new Promise(r => setTimeout(r, [1000, 3000, 7000][attempt - 1]));
        }

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
            max_tokens: 512,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          return data.choices?.[0]?.message?.content || '';
        }

        // Rate limit — retry
        if (response.status === 429) {
          lastError = new Error(`Rate limit: ${await response.text()}`);
          continue;
        }

        // Other errors — throw immediately
        throw new Error(`Groq API error ${response.status}: ${await response.text()}`);
      }

      throw lastError || new Error('Groq API request failed');
    },
  };
}
