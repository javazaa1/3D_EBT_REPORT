// Microsoft Teams notifications through a Power Automate "Workflows" webhook
// (Teams channel → ⋯ → Workflows → "Post to a channel when a webhook request is received").
//
//   TEAMS_WEBHOOK_URL  (Secret)    the workflow's HTTP URL — notifications are off when it is not set
//   TEAMS_NOTIFY       (optional)  which events to send, comma separated; default "comment,reply,upload"
//                                  comment · reply · done (marked แก้แล้ว) · upload (new version)

const HEAD = {
  comment: { icon: '💬', text: 'คอมเมนต์ใหม่', color: 'Attention' },
  reply:   { icon: '↩️', text: 'ตอบกลับคอมเมนต์', color: 'Accent' },
  done:    { icon: '✅', text: 'แก้แล้ว', color: 'Good' },
  upload:  { icon: '📦', text: 'อัพเวอร์ชันใหม่', color: 'Accent' },
  test:    { icon: '🔔', text: 'ทดสอบการแจ้งเตือน', color: 'Accent' },
};

export function wants(env, kind) {
  if (!env.TEAMS_WEBHOOK_URL) return false;
  if (kind === 'test') return true;
  const list = String(env.TEAMS_NOTIFY || 'comment,reply,upload').split(',').map(s => s.trim().toLowerCase());
  return list.includes(kind);
}

const clip = (s, n) => { s = String(s ?? '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/** info: { page, version, author, part, body, date, pin, image, link, parentText, items:[{page,version}] } */
export function card(kind, info) {
  const h = HEAD[kind] || HEAD.comment;
  const facts = [];
  if (info.author) facts.push({ title: kind === 'upload' ? 'ผู้อัพโหลด' : 'โดย', value: clip(info.author, 80) });
  if (info.pin) facts.push({ title: 'หมุด', value: '#' + info.pin });
  if (info.part) facts.push({ title: 'ส่วน', value: clip(info.part, 120) });
  if (info.date) facts.push({ title: 'วันที่', value: info.date });
  const body = [
    { type: 'TextBlock', text: h.icon + ' ' + h.text, weight: 'Bolder', size: 'Medium', color: h.color, wrap: true },
    { type: 'TextBlock', text: clip(info.page || '', 160) + (info.version ? ' · v' + info.version : ''), weight: 'Bolder', wrap: true, spacing: 'Small' },
  ];
  if (facts.length) body.push({ type: 'FactSet', facts, spacing: 'Small' });
  if (info.items && info.items.length) body.push({ type: 'FactSet', spacing: 'Small',
    facts: info.items.slice(0, 20).map(it => ({ title: 'v' + (it.version ?? '?'), value: clip(it.page, 120) })) });
  if (info.items && info.items.length > 20) body.push({ type: 'TextBlock', text: '…และอีก ' + (info.items.length - 20) + ' หน้า', isSubtle: true, size: 'Small' });
  if (info.parentText) body.push({ type: 'TextBlock', text: '↳ ตอบ: ' + clip(info.parentText, 140), isSubtle: true, wrap: true, size: 'Small' });
  if (info.body) body.push({ type: 'TextBlock', text: clip(info.body, 1200), wrap: true, spacing: 'Medium' });
  if (info.image) body.push({ type: 'Image', url: info.image, size: 'Large', altText: 'รูปแนบ', spacing: 'Small' });
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    msteams: { width: 'Full' },
    body,
    actions: info.link ? [{ type: 'Action.OpenUrl', title: kind === 'upload' ? 'เปิดดูงาน' : 'เปิดดูคอมเมนต์', url: info.link }] : [],
  };
}

export async function notifyTeams(env, kind, info) {
  if (!wants(env, kind)) return { sent: false, reason: 'off' };
  const payload = {
    type: 'message',
    attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card(kind, info) }],
  };
  try {
    const r = await fetch(env.TEAMS_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) { const t = await r.text().catch(() => ''); console.error('teams', r.status, t.slice(0, 300)); return { sent: false, status: r.status, error: t.slice(0, 300) }; }
    return { sent: true, status: r.status };
  } catch (e) {
    console.error('teams', e);
    return { sent: false, error: String(e && e.message || e) };
  }
}

/** Page title + version number for messages */
export async function pageInfo(env, key, vid) {
  const [p, v] = await env.DB.batch([
    env.DB.prepare('SELECT unit, label FROM pages WHERE key = ?').bind(key),
    env.DB.prepare(vid ? 'SELECT no FROM versions WHERE key = ? AND vid = ?' : 'SELECT MAX(no) AS no FROM versions WHERE key = ?').bind(...(vid ? [key, vid] : [key])),
  ]);
  const pr = p.results[0], vr = v.results[0];
  return { page: pr ? pr.unit + ' · ' + pr.label : key, version: vr ? vr.no : null };
}

export const fmtTH = d => {
  const x = new Date(d.length === 10 ? d + 'T00:00:00+07:00' : d);
  return isNaN(x) ? d : x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
};
