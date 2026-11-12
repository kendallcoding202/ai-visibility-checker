// Server-side Resend send. The API key stays in the environment.
// Failures log a status code only, never the recipient or the key.
import { fromAddress } from './emailAddress.js';

let testSend = null;

export function setMailerForTests(fn) {
  testSend = fn;
}

export function resetMailerForTests() {
  testSend = null;
}

export async function sendMail({ to, subject, text, html, unsubUrl, idempotencyKey }) {
  if (testSend) return testSend({ to, subject, text, html, unsubUrl, idempotencyKey });
  const from = fromAddress();
  const key = String(process.env.RESEND_API_KEY ?? '').trim();
  if (!from || key.length < 20) return { ok: false, reason: 'unconfigured' };
  if (/[\r\n]/.test(subject) || /[\r\n]/.test(to)) return { ok: false, reason: 'invalid' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'Idempotency-Key': String(idempotencyKey).slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`mail failed status=${res.status}`);
      return { ok: false, reason: 'send' };
    }
    return { ok: true };
  } catch (error) {
    console.error(`mail failed name=${error?.name || 'Error'}`);
    return { ok: false, reason: 'send' };
  }
}
