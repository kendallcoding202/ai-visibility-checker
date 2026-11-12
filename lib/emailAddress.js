// Strict mailbox check. Rejects header injection and display-name tricks.

const EMAIL = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s.length > 254) return null;
  if (/[\u0000-\u0020<>(),:;\\"[\]']/.test(s)) return null;
  if (s.includes('..')) return null;
  if (!EMAIL.test(s)) return null;
  return s;
}

/** From address for Resend. Empty when unset or unsafe. Never log the result. */
export function fromAddress() {
  const raw = String(process.env.RESEND_FROM ?? '').trim();
  if (!raw || raw.length > 200) return '';
  if (/[\r\n\u0000]/.test(raw)) return '';
  const angle = raw.match(/^([^<>]*?)<([^<>]+)>$/);
  const mailbox = normalizeEmail(angle ? angle[2] : raw);
  if (!mailbox) return '';
  if (!angle) return mailbox;
  const name = angle[1].trim();
  if (!name) return mailbox;
  if (/["\\]/.test(name)) return '';
  return `${name} <${mailbox}>`;
}

export function emailCaptureEnabled() {
  const key = String(process.env.RESEND_API_KEY ?? '').trim();
  return process.env.EMAIL_CAPTURE_ENABLED === '1' && key.length >= 20 && fromAddress() !== '';
}

const FIXED_HOSTS = new Set(['aivisibilitychecker.app', 'www.aivisibilitychecker.app']);

/** HTTPS origin for links inside email. Null when the host is not this app. */
export function originForMail(hostHeader) {
  const host = String(hostHeader ?? '').split(',')[0].trim().toLowerCase();
  if (!host || host.length > 200) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host === 'www.aivisibilitychecker.app' || host === 'aivisibilitychecker.app') return 'https://aivisibilitychecker.app';
  if (FIXED_HOSTS.has(host)) return `https://${host}`;
  if (/^ai-visibility-checker[a-z0-9-]*\.vercel\.app$/.test(host)) return `https://${host}`;
  return null;
}
