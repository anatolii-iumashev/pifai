import { serve } from '@hono/node-server';
import { createApp, configFromEnv } from './server.js';

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: createApp(configFromEnv()).fetch, port });
console.log(JSON.stringify({ event: 'listening', port }));
