import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from './websiteAudit.js';

test('audit returns skipped when no website provided', async () => {
  const result = await audit(null, 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.skipped, true);
});

test('audit rejects 127.0.0.1 (loopback)', async () => {
  const result = await audit('http://127.0.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Private IP|DNS resolution|Audit failed|Could not read/i);
});

test('audit rejects 10.0.0.1 (private class A)', async () => {
  const result = await audit('http://10.0.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 172.16.0.1 (private class B)', async () => {
  const result = await audit('http://172.16.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 192.168.1.1 (private class C)', async () => {
  const result = await audit('http://192.168.1.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 169.254.169.254 (metadata service)', async () => {
  const result = await audit('http://169.254.169.254', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 0.0.0.0', async () => {
  const result = await audit('http://0.0.0.0', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 100.64.0.1 (carrier-grade NAT)', async () => {
  const result = await audit('http://100.64.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 192.0.0.1', async () => {
  const result = await audit('http://192.0.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 198.18.0.1 (benchmark)', async () => {
  const result = await audit('http://198.18.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 224.0.0.1 (multicast)', async () => {
  const result = await audit('http://224.0.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 240.0.0.1 (reserved)', async () => {
  const result = await audit('http://240.0.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects 255.255.255.255 (broadcast)', async () => {
  const result = await audit('http://255.255.255.255', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects http://[::1] (IPv6 loopback)', async () => {
  const result = await audit('http://[::1]', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects http://[fc00::1] (IPv6 private ULA)', async () => {
  const result = await audit('http://[fc00::1]', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects http://[fe80::1] (IPv6 link-local)', async () => {
  const result = await audit('http://[fe80::1]', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects http://[ff00::1] (IPv6 multicast)', async () => {
  const result = await audit('http://[ff00::1]', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects ftp:// protocol', async () => {
  const result = await audit('ftp://example.com', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Invalid protocol|Audit failed|Could not read/i);
});

test('audit rejects file:// protocol', async () => {
  const result = await audit('file:///etc/passwd', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});

test('audit rejects URL with credentials', async () => {
  const result = await audit('https://user:pass@example.com', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Credentials|Audit failed|Could not read/i);
});

test('audit handles DNS resolution failure', async () => {
  const result = await audit('https://this-domain-definitely-does-not-exist-12345.com', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
});
