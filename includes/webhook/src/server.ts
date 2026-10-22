import { Hono } from 'hono';
import { MAX_BODY_BYTES, jobFromUpdate, readLimited, type ConsultationJob } from './job.js';
import { enqueueConsultation, type TriggerConfig } from './trigger.js';

export interface WebhookConfig extends TriggerConfig {
  webhookSecret: string;
}

export function createApp(config: WebhookConfig, http: typeof fetch = fetch): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }, 200, { 'Cache-Control': 'no-store' }));
  app.onError((error, c) => {
    console.error(JSON.stringify({ event: 'unhandled_error', message: String(error) }));
    return c.text('Internal Server Error', 500);
  });

  app.post('/webhook', async (c) => {
    // The secret header is checked before the body is read.
    if (!config.webhookSecret || !config.triggerSecretKey) return c.text('Unavailable', 503);
    if (c.req.header('X-Telegram-Bot-Api-Secret-Token') !== config.webhookSecret) {
      return c.text('Unauthorized', 401);
    }
    const declaredSize = Number(c.req.header('content-length'));
    if (declaredSize > MAX_BODY_BYTES) return c.text('Payload too large', 413);

    let job: ConsultationJob | null;
    try {
      job = jobFromUpdate(JSON.parse(await readLimited(c.req.raw)));
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'body-too-large';
      return c.text(tooLarge ? 'Payload too large' : 'Invalid payload', tooLarge ? 413 : 400);
    }
    if (!job) return c.text('Ignored', 200);

    try {
      await enqueueConsultation(job, config, http);
    } catch (error) {
      console.error(JSON.stringify({ event: 'enqueue_failed', updateId: job.updateId, message: String(error) }));
      return c.text('Queue unavailable', 503);
    }
    return c.text('Accepted', 200, { 'Cache-Control': 'no-store' });
  });

  app.all('/webhook', (c) => c.text('Method not allowed', 405, { Allow: 'POST' }));
  app.all('*', (c) => c.text('Not found', 404));
  return app;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): WebhookConfig {
  if (!env.TELEGRAM_WEBHOOK_SECRET) throw new Error('TELEGRAM_WEBHOOK_SECRET is required');
  if (!env.TRIGGER_SECRET_KEY) throw new Error('TRIGGER_SECRET_KEY is required');
  return {
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    triggerSecretKey: env.TRIGGER_SECRET_KEY,
    triggerApiUrl: env.TRIGGER_API_URL,
  };
}
