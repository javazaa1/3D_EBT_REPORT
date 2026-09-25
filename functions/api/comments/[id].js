// PATCH  /api/comments/:id   JSON { status?: 'open'|'done', body?: string }
// DELETE /api/comments/:id   removes the comment, its replies and their images
import { json, toComment } from '../../../lib/review.js';

export async function onRequestPatch({ params, request, env }) {
  const id = String(params.id);
  const p = await request.json().catch(() => ({}));
  const sets = [], vals = [];
  if (p.status !== undefined) {
    if (!['open', 'done'].includes(p.status)) return json({ error: 'status must be open or done' }, 400);
    sets.push('status = ?'); vals.push(p.status);
  }
  if (p.body !== undefined) {
    const b = String(p.body).trim().slice(0, 5000);
    if (!b) return json({ error: 'ข้อความว่าง' }, 400);
    sets.push('body = ?'); vals.push(b);
  }
  if (!sets.length) return json({ error: 'Nothing to update' }, 400);
  sets.push('updated_at = ?'); vals.push(new Date().toISOString());
  const r = await env.DB.prepare(`UPDATE comments SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  if (!r.meta.changes) return json({ error: 'Not found' }, 404);
  const row = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first();
  return json(toComment(row));
}

export async function onRequestDelete({ params, env }) {
  const id = String(params.id);
  const { results } = await env.DB.prepare('SELECT images FROM comments WHERE id = ? OR parent_id = ?').bind(id, id).all();
  if (!results.length) return json({ error: 'Not found' }, 404);
  const keys = results.flatMap(r => JSON.parse(r.images || '[]'));
  if (keys.length) await env.IMAGES.delete(keys);
  await env.DB.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').bind(id, id).run();
  return json({ ok: true, deleted: results.length });
}
