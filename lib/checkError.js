// User-facing check failures. Keep these free of brand names, IPs, and provider details.

export const CHECK_TIMEOUT_ERROR = 'This check took too long. Your free check was not used, please try again.';
export const CHECK_UNREADABLE_ERROR = 'This check took too long. Please try again.';
export const RESULT_UNAVAILABLE_ERROR = 'This result is temporarily unavailable. Please reload in a minute.';
export const LOOKUP_UNAVAILABLE_ERROR = 'This lookup is temporarily unavailable. Please reload in a minute.';

export class CheckTimeoutError extends Error {
  constructor() {
    super('check timed out');
    this.name = 'CheckTimeoutError';
  }
}

export function isCheckTimeout(err) {
  const name = err && typeof err === 'object' ? err.name : '';
  return name === 'TimeoutError' || name === 'AbortError' || name === 'CheckTimeoutError';
}

/** String error for a non-OK /api/check body. Never returns an object (which renders as "[object Object]"). */
export function messageFromFailedCheck(bodyText) {
  let data = null;
  try {
    data = JSON.parse(String(bodyText ?? ''));
  } catch {
    data = null;
  }
  const error = data && typeof data === 'object' ? data.error : undefined;
  if (typeof error === 'string') {
    const message = error.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (message) return message;
  }
  return CHECK_UNREADABLE_ERROR;
}
