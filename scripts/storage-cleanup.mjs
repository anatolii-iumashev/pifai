// Removes objects older than MAX_AGE_DAYS from a Bunny Storage zone —
// the substitute for the native lifecycle rules Bunny Storage does not have.
// Walks the prefix recursively (list → files + directories), deletes stale files.
const host = process.env.BUNNY_STORAGE_HOST ?? 'storage.bunnycdn.com';
const zone = process.env.BUNNY_STORAGE_ZONE;
const accessKey = process.env.BUNNY_STORAGE_ACCESS_KEY;
const prefix = (process.env.CLEANUP_PREFIX ?? 'pifai').replace(/\/$/, '');
const maxAgeDays = Number(process.env.MAX_AGE_DAYS ?? 7);
if (!zone || !accessKey) throw new Error('BUNNY_STORAGE_ZONE and BUNNY_STORAGE_ACCESS_KEY are required');

const base = `https://${host}/${zone}`;
const headers = { AccessKey: accessKey };
const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

async function list(path) {
  const response = await fetch(`${base}/${path}/`, { headers });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`List ${path}: HTTP ${response.status}`);
  const body = await response.json();
  return Array.isArray(body) ? body : [];
}

async function remove(path) {
  const response = await fetch(`${base}/${path}`, { method: 'DELETE', headers });
  if (!response.ok && response.status !== 404) throw new Error(`Delete ${path}: HTTP ${response.status}`);
}

async function walk(path, counters) {
  for (const entry of await list(path)) {
    const name = entry.ObjectName;
    if (name === '$folder$') continue;
    const child = `${path}/${name}`;
    if (entry.IsDirectory) {
      await walk(child, counters);
      continue;
    }
    const changed = Date.parse(entry.LastChanged ?? entry.DateCreated ?? '');
    if (Number.isFinite(changed) && changed < cutoff) {
      await remove(child);
      counters.deleted++;
    } else {
      counters.kept++;
    }
  }
}

const counters = { deleted: 0, kept: 0 };
await walk(prefix, counters);
console.log(JSON.stringify({ zone, prefix, maxAgeDays, deleted: counters.deleted, kept: counters.kept }));
