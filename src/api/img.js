// GET /api/img/<page>/<comment-id>/<n>.jpg  → image from R2
export async function serveImage({ params, env, request }) {
  const key = (params.path || []).join('/');
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  if (request.headers.get('if-none-match') === obj.httpEtag) return new Response(null, { status: 304 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');   // keys never get reused
  h.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers: h });
}
