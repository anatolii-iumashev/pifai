/**
 * dev-server.ts — Локальный dev-сервер (только для Node.js)
 *
 * Запускает Hono-приложение в Node.js через createServer.
 * Не используется в Cloudflare Workers — там wrangler читает src/index.ts напрямую.
 *
 * Запуск: node --import tsx src/dev-server.ts
 */

import { createServer } from 'node:http';
import app from './index';

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      duplex: 'half',
    });

    const response = await app.request(request);
    const headers = Object.fromEntries(response.headers.entries());
    res.writeHead(response.status, headers);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}).listen(port, () => {
  console.log(`Local Hono server running on http://127.0.0.1:${port}`);
});