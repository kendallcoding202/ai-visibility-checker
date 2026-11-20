import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HSTS_VALUE, contentSecurityPolicy } from './securityHeaders.js';

function directive(csp, name) {
  return csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(name));
}

test('HSTS is two years with includeSubDomains and without preload', () => {
  assert.equal(HSTS_VALUE, 'max-age=63072000; includeSubDomains');
  assert.equal(HSTS_VALUE.includes('preload'), false);
});

test('production script-src uses a nonce and strict-dynamic', () => {
  const csp = contentSecurityPolicy({ nonce: 'abc123+/=', dev: false });
  const script = directive(csp, 'script-src');
  const style = directive(csp, 'style-src');
  assert.equal(script, "script-src 'self' 'nonce-abc123+/=' 'strict-dynamic'");
  assert.equal(script.includes('unsafe-inline'), false);
  assert.equal(script.includes('unsafe-eval'), false);
  assert.equal(style, "style-src 'self' 'unsafe-inline'");
  assert.equal(csp.includes('https://fazier.com'), true);
  assert.equal(csp.includes('https://smollaunch.com'), true);
  assert.equal(csp.includes('https://www.aitoolfinder.com'), true);
  assert.equal(csp.includes('upgrade-insecure-requests'), true);
});

test('development script-src adds unsafe-eval only', () => {
  const script = directive(contentSecurityPolicy({ nonce: 'devnonce', dev: true }), 'script-src');
  assert.equal(script, "script-src 'self' 'nonce-devnonce' 'strict-dynamic' 'unsafe-eval'");
  assert.equal(script.includes('unsafe-inline'), false);
});

test('CSP rejects a nonce that would break the header', () => {
  assert.throws(() => contentSecurityPolicy({ nonce: "abc'; script-src *" }), /Invalid CSP nonce/);
});
