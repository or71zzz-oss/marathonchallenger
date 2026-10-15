import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');
const SNAPSHOT_ID = 'main';

let queue = Promise.resolve();
let schemaReady = false;

async function ensureSchemaOnce() {
  if (schemaReady) return;
  await ensureSchema();
  schemaReady = true;
}

function emptyDb() {
  return { users: [], sessions: [], races: [] };
}

function readDbFile() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function useNeon() {
  return Boolean(process.env.DATABASE_URL);
}

function getSql() {
  return neon(process.env.DATABASE_URL);
}

function normalizeDb(raw) {
  if (!raw || typeof raw !== 'object') return emptyDb();
  return {
    users: Array.isArray(raw.users) ? raw.users : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    races: Array.isArray(raw.races) ? raw.races : [],
  };
}

async function readNeon() {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`SELECT data FROM app_snapshot WHERE id = ${SNAPSHOT_ID}`;
  if (!rows.length) return emptyDb();
  return normalizeDb(rows[0].data);
}

async function updateNeon(mutator) {
  await ensureSchemaOnce();
  const sql = getSql();
  const rows = await sql`SELECT data FROM app_snapshot WHERE id = ${SNAPSHOT_ID}`;
  const db = rows.length ? normalizeDb(rows[0].data) : emptyDb();
  const result = mutator(db);
  const payload = JSON.stringify(db);
  await sql`
    INSERT INTO app_snapshot (id, data)
    VALUES (${SNAPSHOT_ID}, ${payload}::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET data = ${payload}::jsonb, updated_at = now()
  `;
  return result;
}

function readFile() {
  return queue.then(() => readDbFile());
}

function updateFile(mutator) {
  const run = queue.then(() => {
    const db = readDbFile();
    const result = mutator(db);
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function readNeonQueued() {
  const run = queue.then(() => readNeon());
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function updateNeonQueued(mutator) {
  const run = queue.then(() => updateNeon(mutator));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function read() {
  if (useNeon()) return readNeonQueued();
  return readFile();
}

export function update(mutator) {
  if (useNeon()) return updateNeonQueued(mutator);
  return updateFile(mutator);
}

export async function ensureSchema() {
  if (!useNeon()) {
    throw new Error('DATABASE_URL is required to run schema setup.');
  }
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS app_snapshot (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export async function seedFromFile({ force = false } = {}) {
  if (!useNeon()) {
    throw new Error('DATABASE_URL is required to seed Neon.');
  }
  await ensureSchema();
  const sql = getSql();
  const existing = await sql`SELECT id FROM app_snapshot WHERE id = ${SNAPSHOT_ID}`;
  if (existing.length && !force) {
    return { seeded: false, reason: 'already_exists' };
  }
  const data = readDbFile();
  const payload = JSON.stringify(data);
  await sql`
    INSERT INTO app_snapshot (id, data)
    VALUES (${SNAPSHOT_ID}, ${payload}::jsonb)
    ON CONFLICT (id) DO UPDATE
    SET data = ${payload}::jsonb, updated_at = now()
  `;
  return { seeded: true };
}
