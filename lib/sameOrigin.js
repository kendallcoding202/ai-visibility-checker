export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  const hostHdr = req.headers.get('host');
  let host = null;
  try { host = new URL(origin).host; } catch { return false; }
  return Boolean(host && hostHdr && host === hostHdr);
}

export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
}
