import pg from 'pg';
import type { ConsultationJob } from '../../edge/src/handler.js';

export type JobStatus = 'processing' | 'ready' | 'attempted' | 'delivered';
export interface JobRecord {
  status: JobStatus;
  responseText: string | null;
}
export interface HistoryMessage { role: 'user' | 'assistant'; content: string }

export interface DialogueStore {
  getOrCreate(job: ConsultationJob): Promise<JobRecord>;
  history(chatId: number): Promise<HistoryMessage[]>;
  clear(chatId: number): Promise<void>;
  saveResult(job: ConsultationJob, response: string, model: string, version: string, saveHistory: boolean): Promise<void>;
  markAttempted(updateId: number): Promise<boolean>;
  markDelivered(updateId: number, messageIds: number[]): Promise<void>;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });

export function postgresStore(): DialogueStore {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return {
    async getOrCreate(job) {
      await pool.query('DELETE FROM chat_messages WHERE created_at < now() - interval \'7 days\'');
      await pool.query('DELETE FROM consultation_jobs WHERE created_at < now() - interval \'7 days\'');
      await pool.query(`INSERT INTO consultation_jobs (update_id, chat_id, input_message_id, status)
        VALUES ($1, $2, $3, 'processing') ON CONFLICT (platform, update_id) DO NOTHING`, [job.updateId, job.chatId, job.messageId]);
      const result = await pool.query('SELECT status, response_text FROM consultation_jobs WHERE platform = \'telegram\' AND update_id = $1', [job.updateId]);
      return { status: result.rows[0].status, responseText: result.rows[0].response_text };
    },
    async history(chatId) {
      const result = await pool.query(`SELECT role, content FROM chat_messages
        WHERE platform = 'telegram' AND chat_id = $1 AND created_at >= now() - interval '7 days'
        ORDER BY created_at DESC, input_message_id DESC, role ASC LIMIT 20`, [chatId]);
      return result.rows.reverse();
    },
    async clear(chatId) {
      await pool.query('DELETE FROM chat_messages WHERE platform = \'telegram\' AND chat_id = $1', [chatId]);
    },
    async saveResult(job, response, model, version, saveHistory) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (saveHistory) {
          await client.query(`INSERT INTO chat_messages (chat_id, input_message_id, role, content)
            VALUES ($1, $2, 'user', $3) ON CONFLICT DO NOTHING`, [job.chatId, job.messageId, job.text]);
          await client.query(`INSERT INTO chat_messages (chat_id, input_message_id, role, content)
            VALUES ($1, $2, 'assistant', $3) ON CONFLICT DO NOTHING`, [job.chatId, job.messageId, response]);
          await client.query(`DELETE FROM chat_messages WHERE (platform, chat_id, input_message_id, role) IN (
            SELECT platform, chat_id, input_message_id, role FROM chat_messages
            WHERE platform = 'telegram' AND chat_id = $1
            ORDER BY created_at DESC, input_message_id DESC, role ASC OFFSET 20
          )`, [job.chatId]);
        }
        await client.query(`UPDATE consultation_jobs SET status = 'ready', response_text = $2,
          model = $3, knowledge_version = $4, updated_at = now()
          WHERE platform = 'telegram' AND update_id = $1 AND status = 'processing'`,
          [job.updateId, response, model, version]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async markAttempted(updateId) {
      const result = await pool.query(`UPDATE consultation_jobs SET status = 'attempted', updated_at = now()
        WHERE platform = 'telegram' AND update_id = $1 AND status = 'ready'`, [updateId]);
      return result.rowCount === 1;
    },
    async markDelivered(updateId, messageIds) {
      await pool.query(`UPDATE consultation_jobs SET status = 'delivered', telegram_message_ids = $2, updated_at = now()
        WHERE platform = 'telegram' AND update_id = $1 AND status = 'attempted'`, [updateId, messageIds]);
    },
  };
}
