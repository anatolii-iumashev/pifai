import { execFileSync, spawnSync } from 'node:child_process';

let sha = 'nogit';
try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* source archive */ }
const buildId = process.env.RAG_BUILD_ID || `${sha}-${new Date().toISOString()}`;
const env = { ...process.env, NODE_ENV: 'production', RAG_BUILD_ID: buildId };
for (const [command, args] of [
  ['./node_modules/.bin/astro', ['build']],
  [process.execPath, ['--import', 'tsx', 'scripts/build-rag-embeddings.ts']],
]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
