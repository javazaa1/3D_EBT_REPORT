// Runs before every /api/* request.
//  • If the REVIEW_KEY variable is set, writes (POST/PATCH/DELETE) need header  x-review-key: <REVIEW_KEY>
//  • Checks the D1 / R2 bindings exist and turns thrown errors into JSON.
import { json } from '../../lib/review.js';

export async function onRequest({ request, env, next }) {
  if (!env.DB || !env.IMAGES) return json({ error: 'Missing D1 (DB) or R2 (IMAGES) binding — see README' }, 500);
  if (request.method !== 'GET' && request.method !== 'HEAD' && env.REVIEW_KEY) {
    if (request.headers.get('x-review-key') !== env.REVIEW_KEY) return json({ error: 'Review key required' }, 401);
  }
  try {
    return await next();
  } catch (e) {
    console.error(e);
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
