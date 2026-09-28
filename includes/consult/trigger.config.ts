import { defineConfig } from '@trigger.dev/sdk';

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_rfldgyqffeltidshyifn',
  runtime: 'node-24',
  dirs: ['./src/trigger'],
  maxDuration: 180,
});
