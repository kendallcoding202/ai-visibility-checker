import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, setResolver, resetAgent, isPrivateIPv4, isPrivateIPv6 } from './websiteAudit.js';
import { createServer } from 'node:http';

const mockResolver = {
  resolve4: async (hostname) => {
    const map = {
      'example.com': ['93.184.216.34'],
      'private-ipv4.test': ['127.0.0.1'],
      'private-10.test': ['10.0.0.1'],
      'private-172.test': ['172.16.0.1'],
      'private-192.test': ['192.168.1.1'],
      'metadata.test': ['169.254.169.254'],
      'zero.test': ['0.0.0.0'],
      'cgnat.test': ['100.64.0.1'],
      'ietf.test': ['192.0.0.1'],
      'benchmark.test': ['198.18.0.1'],
      'multicast.test': ['224.0.0.1'],
      'reserved.test': ['240.0.0.1'],
      'broadcast.test': ['255.255.255.255'],
    };
    if (map[hostname]) return map[hostname];
    throw new Error('ENOTFOUND');
  },
  resolve6: async () => [],
};

test('audit returns skipped when no website provided', async () => {
  const result = await audit(null, 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.skipped, true);
});

test('isPrivateIPv4 rejects 127.0.0.1 (loopback)', () => {
  assert.equal(isPrivateIPv4('127.0.0.1'), true);
});

test('isPrivateIPv4 rejects 10.0.0.1 (private class A)', () => {
  assert.equal(isPrivateIPv4('10.0.0.1'), true);
});

test('isPrivateIPv4 rejects 172.16.0.1 (private class B)', () => {
  assert.equal(isPrivateIPv4('172.16.0.1'), true);
});

test('isPrivateIPv4 rejects 192.168.1.1 (private class C)', () => {
  assert.equal(isPrivateIPv4('192.168.1.1'), true);
});

test('isPrivateIPv4 rejects 169.254.169.254 (metadata service)', () => {
  assert.equal(isPrivateIPv4('169.254.169.254'), true);
});

test('isPrivateIPv4 rejects 0.0.0.0', () => {
  assert.equal(isPrivateIPv4('0.0.0.0'), true);
});

test('isPrivateIPv4 rejects 100.64.0.1 (carrier-grade NAT)', () => {
  assert.equal(isPrivateIPv4('100.64.0.1'), true);
});

test('isPrivateIPv4 rejects 192.0.0.1', () => {
  assert.equal(isPrivateIPv4('192.0.0.1'), true);
});

test('isPrivateIPv4 rejects 198.18.0.1 (benchmark)', () => {
  assert.equal(isPrivateIPv4('198.18.0.1'), true);
});

test('isPrivateIPv4 rejects 224.0.0.1 (multicast)', () => {
  assert.equal(isPrivateIPv4('224.0.0.1'), true);
});

test('isPrivateIPv4 rejects 240.0.0.1 (reserved)', () => {
  assert.equal(isPrivateIPv4('240.0.0.1'), true);
});

test('isPrivateIPv4 rejects 255.255.255.255 (broadcast)', () => {
  assert.equal(isPrivateIPv4('255.255.255.255'), true);
});

test('isPrivateIPv4 allows public IP', () => {
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
});

test('isPrivateIPv6 rejects ::1 (loopback)', () => {
  assert.equal(isPrivateIPv6('::1'), true);
});

test('isPrivateIPv6 rejects fc00::1 (private ULA)', () => {
  assert.equal(isPrivateIPv6('fc00::1'), true);
});

test('isPrivateIPv6 rejects fe80::1 (link-local)', () => {
  assert.equal(isPrivateIPv6('fe80::1'), true);
});

test('isPrivateIPv6 rejects ff00::1 (multicast)', () => {
  assert.equal(isPrivateIPv6('ff00::1'), true);
});

test('isPrivateIPv6 allows public IPv6', () => {
  assert.equal(isPrivateIPv6('2001:4860:4860::8888'), false);
});

test('audit rejects hostname resolving to private IP', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('http://private-ipv4.test', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects IP literal 127.0.0.1', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('http://127.0.0.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects IP literal [::1]', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('http://[::1]', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects odd IPv4 form 2130706433', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('http://2130706433', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects odd IPv4 form 0x7f000001', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('http://0x7f000001', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects odd IPv4 form 127.1', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('http://127.1', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects ftp:// protocol', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('ftp://example.com', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects file:// protocol', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('file:///etc/passwd', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit rejects URL with credentials', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('https://user:pass@example.com', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit handles DNS resolution failure', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('https://nonexistent-domain-12345.test', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('audit with real local server proves hostname lookup validates IPs', async (t) => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Test</body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const privateResolver = {
    resolve4: async () => ['127.0.0.1'],
    resolve6: async () => [],
  };
  setResolver(privateResolver);
  resetAgent();
  
  const result = await audit(`http://localhost-test.fake:${port}`, 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);

  server.close();
});
