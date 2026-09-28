import * as BunnySDK from '@bunny.net/edgescript-sdk';
import { handleRequest } from './handler.js';

declare const Deno: { env: { get(name: string): string | undefined } };

BunnySDK.net.http.serve((request: Request) => handleRequest(request, {
  webhookSecret: Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '',
  triggerSecretKey: Deno.env.get('TRIGGER_SECRET_KEY') ?? '',
}));
