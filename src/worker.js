// Worker entry (used when the repo is deployed as a Cloudflare *Worker* via `wrangler deploy`).
// Static files in /public are served by the assets layer before this runs;
// only /api/* reaches here and is routed to the same handlers Pages Functions use.
import { onRequest as middleware } from '../functions/api/_middleware.js';
import * as comments from '../functions/api/comments/index.js';
import * as comment from '../functions/api/comments/[id].js';
import * as img from '../functions/api/img/[[path]].js';
import { json } from '../lib/review.js';

function route(method, path) {
  let m;
  if (path === '/api/comments') {
    return { handler: { GET: comments.onRequestGet, POST: comments.onRequestPost }[method], params: {} };
  }
  if ((m = /^\/api\/comments\/([^/]+)$/.exec(path))) {
    return { handler: { PATCH: comment.onRequestPatch, DELETE: comment.onRequestDelete }[method], params: { id: decodeURIComponent(m[1]) } };
  }
  if (path.startsWith('/api/img/')) {
    return { handler: { GET: img.onRequestGet }[method], params: { path: path.slice(9).split('/').map(decodeURIComponent) } };
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const r = route(request.method, url.pathname);
    if (!r) return json({ error: 'Not found' }, 404);
    if (!r.handler) return json({ error: 'Method not allowed' }, 405);
    const context = { request, env, params: r.params, waitUntil: p => ctx.waitUntil(p) };
    return middleware({ ...context, next: () => r.handler(context) });
  },
};
