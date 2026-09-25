// Runs before every /api/* request.
//  • If the REVIEW_KEY variable is set, writes (POST/PATCH/DELETE) need header  x-review-key: <REVIEW_KEY>
//  • Checks the D1 / R2 bindings exist and turns thrown errors into JSON.
import { json } from '../../lib/review.js';

// Creates the table on first use, so no manual SQL step is needed (schema.sql is kept for reference).
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, page TEXT NOT NULL, parent_id TEXT, no INTEGER,
    author TEXT NOT NULL, part TEXT, body TEXT NOT NULL, review_date TEXT, anchor TEXT, view TEXT,
    images TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT)`,
  'CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)',
];
let schemaReady = null;

export async function onRequest({ request, env, next }) {
  if (!env.DB || !env.IMAGES) return json({ error: 'Missing D1 (DB) or R2 (IMAGES) binding — see README' }, 500);
  if (request.method !== 'GET' && request.method !== 'HEAD' && env.REVIEW_KEY) {
    if (request.headers.get('x-review-key') !== env.REVIEW_KEY) return json({ error: 'Review key required' }, 401);
  }
  try {
    schemaReady ??= env.DB.batch(SCHEMA.map(q => env.DB.prepare(q))).catch(e => { schemaReady = null; throw e; });
    await schemaReady;
    return await next();
  } catch (e) {
    console.error(e);
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
