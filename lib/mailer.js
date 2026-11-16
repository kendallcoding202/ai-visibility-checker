// Server-side Resend send. The API key stays in the environment.
// Failures log a status code only, never the recipient or the key.
import { fromAddress } from './emailAddress.js';
import { hashKey } from './hash.js';

// Resend stores a key for 24 hours and returns 409 when that key is reused with a
// different body. Each confirmation gets its own key: hashed token plus hashed
// address. A retry repeats the key. A later signup to the same address sends.
// The raw address and token are never placed in the key.
export function confirmIdempotencyKey(confirmToken, email) {
  return `confirm/${hashKey(confirmToken)}/${hashKey(email)}`;
}

export function reportIdempotencyKey(confirmToken, email) {
  return `report/${hashKey(confirmToken)}/${hashKey(email)}`;
}

export function paidReportIdempotencyKey(paymentIntentId, email) {
  return `paid-report/${hashKey(paymentIntentId)}/${hashKey(email)}`;
}

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
      if (res.status === 409) {
        // 409 has two meanings in Resend:
        // 1. concurrent_idempotent_requests: original is in flight, retry once
        // 2. invalid_idempotent_request: same key, different payload, nothing sent
        let errorName = 'unknown';
        try {
          const errorData = await res.json();
          errorName = errorData?.name || 'unknown';
        } catch {
          // JSON parse failed, treat as unknown
        }
        
        if (errorName === 'concurrent_idempotent_requests') {
          // Original send is in flight. Wait briefly and retry once.
          console.log(`mail concurrent key=${idempotencyKey.slice(0, 16)}... status=409 name=${errorName}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry once with same params
          try {
            const retryRes = await fetch('https://api.resend.com/emails', {
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
            
            if (retryRes.ok) return { ok: true };
            console.error(`mail retry failed status=${retryRes.status}`);
          } catch (error) {
            console.error(`mail retry failed name=${error?.name || 'Error'}`);
          }
          return { ok: false, reason: 'send' };
        }
        
        if (errorName === 'invalid_idempotent_request') {
          // Same key, different payload. The original succeeded, this payload was NOT sent.
          // This is a bug - the same logical email should have byte-identical payload.
          console.error(`mail idempotent mismatch key=${idempotencyKey.slice(0, 16)}... status=409 name=${errorName}`);
          return { ok: false, reason: 'send' };
        }
        
        // Unknown 409 reason
        console.error(`mail failed status=409 name=${errorName}`);
        return { ok: false, reason: 'send' };
      }
      console.error(`mail failed status=${res.status}`);
      return { ok: false, reason: 'send' };
    }
    return { ok: true };
  } catch (error) {
    console.error(`mail failed name=${error?.name || 'Error'}`);
    return { ok: false, reason: 'send' };
  }
}
