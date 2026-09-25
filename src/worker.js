// Worker entry. Static files in /public (incl. the build output of uploads/) are served by the
// assets layer before this runs; everything else lands here.
import { json, ensureSchema } from './lib.js';
import * as comments from './api/comments.js';
import * as pages from './api/pages.js';
import { serveImage } from './api/img.js';

const ROUTES = [
  ['GET',    /^\/api\/comments$/,                         comments.list],
  ['POST',   /^\/api\/comments$/,                         comments.create],
  ['PATCH',  /^\/api\/comments\/(?<id>[^/]+)$/,           comments.update],
  ['DELETE', /^\/api\/comments\/(?<id>[^/]+)$/,           comments.remove],
  ['GET',    /^\/api\/img\/(?<path>.+)$/,                 serveImage],
  ['GET',    /^\/api\/pages$/,                            pages.listPages],
  ['POST',   /^\/api\/versions$/,                         pages.addVersion],
  ['DELETE', /^\/api\/versions\/(?<key>[^/]+)\/(?<vid>[^/]+)$/, pages.deleteVersion],
  ['PUT',    /^\/api\/files\/(?<path>.+)$/,               pages.putFile],
  ['GET',    /^\/api\/upload-auth$/,                     pages.checkUpload],
];
const COMMENT_WRITE = new Set(['POST', 'PATCH', 'DELETE']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (/^\/(p|lib|src)\//.test(path) && (request.method === 'GET' || request.method === 'HEAD')) {
      return pages.serveStored({ request, env });
    }
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.DB || !env.IMAGES) return json({ error: 'Missing D1 (DB) or R2 (IMAGES) binding' }, 500);

    let handler = null, params = {}, pathMatched = false;
    for (const [m, re, fn] of ROUTES) {
      const hit = re.exec(path);
      if (!hit) continue;
      pathMatched = true;
      if (m === request.method) { handler = fn; params = Object.fromEntries(Object.entries(hit.groups || {}).map(([k, v]) => [k, k === 'path' ? v : decodeURIComponent(v)])); break; }
    }
    if (!handler) return json({ error: pathMatched ? 'Method not allowed' : 'Not found' }, pathMatched ? 405 : 404);
    if (params.path && handler !== serveImage) params.path = decodeURIComponent(params.path);
    if (handler === serveImage) params.path = params.path.split('/').map(decodeURIComponent);

    // optional shared key for comment writes
    if (path.startsWith('/api/comments') && COMMENT_WRITE.has(request.method) && env.REVIEW_KEY &&
        request.headers.get('x-review-key') !== env.REVIEW_KEY) {
      return json({ error: 'Review key required', code: 'review_key' }, 401);
    }
    try {
      await ensureSchema(env);
      return await handler({ request, env, params, waitUntil: p => ctx.waitUntil(p) });
    } catch (e) {
      console.error(e);
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};
