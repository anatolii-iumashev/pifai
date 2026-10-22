export interface ConsultationJob {
  schemaVersion: 1;
  updateId: number;
  chatId: number;
  messageId: number;
  userId: number;
  text: string;
  receivedAt: string;
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
