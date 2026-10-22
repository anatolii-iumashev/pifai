import type { ConsultationJob } from './job.js';

export interface TriggerConfig {
  triggerSecretKey: string;
  triggerApiUrl?: string;
}

export interface TriggerHandle {
  id: string;
}

export async function enqueueConsultation(
  job: ConsultationJob,
  config: TriggerConfig,
  http: typeof fetch = fetch,
): Promise<string> {
  const apiUrl = (config.triggerApiUrl ?? 'https://api.trigger.dev').replace(/\/$/, '');
  const response = await http(`${apiUrl}/api/v1/tasks/consult-telegram/trigger`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.triggerSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload: job,
      options: {
        idempotencyKey: `pifai:tg:${job.updateId}`,
        idempotencyKeyTTL: '7d',
        concurrencyKey: String(job.chatId),
      },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Trigger.dev unavailable (HTTP ${response.status})`);
  const handle = await response.json() as { id?: unknown };
  if (typeof handle.id !== 'string' || !handle.id) throw new Error('Trigger.dev returned no run id');
  return handle.id;
}
