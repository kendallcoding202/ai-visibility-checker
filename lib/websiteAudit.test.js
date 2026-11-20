import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { audit, setResolver, resetAgent, isPrivateIPv4, isPrivateIPv6, isBlockedAddress, pinnedLookup, setRequestForTests, resetRequestForTests } from './websiteAudit.js';
import { createServer } from 'node:http';

beforeEach(() => {
  resetRequestForTests();
});

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

test('audit rejects URL with credentials before fetch', async () => {
  setResolver(mockResolver);
  resetAgent();
  const fetched = [];
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    throw new Error('fetch');
  });
  const result = await audit('https://user:pass@example.com', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
  assert.equal(fetched.length, 0);
});

test('audit handles DNS resolution failure', async () => {
  setResolver(mockResolver);
  resetAgent();
  const result = await audit('https://nonexistent-domain-12345.test', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.match(result.message, /Could not read this site/i);
});

test('WHATWG URL rewrites the mapped and odd IPv4 forms the string check used to miss', () => {
  assert.equal(new URL('http://[::ffff:127.0.0.1]/').hostname, '[::ffff:7f00:1]');
  assert.equal(new URL('http://[::ffff:169.254.169.254]/').hostname, '[::ffff:a9fe:a9fe]');
  assert.equal(new URL('http://2130706433/').hostname, '127.0.0.1');
  assert.equal(new URL('http://0x7f000001/').hostname, '127.0.0.1');
  assert.equal(new URL('http://0177.0.0.1/').hostname, '127.0.0.1');
  assert.equal(new URL('http://127.1/').hostname, '127.0.0.1');
});

test('classifier blocks mapped, compatible, NAT64, 6to4, and reserved ranges', () => {
  const blocked = [
    '::ffff:7f00:1',
    '::ffff:127.0.0.1',
    '[::ffff:7f00:1]',
    '::ffff:a9fe:a9fe',
    '::ffff:169.254.169.254',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    'fc00::1',
    'fec0::1',
    'ff00::1',
    '2001:db8::1',
    '64:ff9b::7f00:1',
    '64:ff9b::127.0.0.1',
    '64:ff9b::a9fe:a9fe',
    '64:ff9b:1:7f00:0:100::',
    '::7f00:1',
    '::127.0.0.1',
    '::808:808',
    '2002:7f00:1::',
    '2002:a9fe:a9fe::',
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.255',
    '0.0.0.0',
    '192.0.0.255',
    '198.19.255.255',
    '240.0.0.0',
    '255.255.255.255',
    '',
    'not-an-ip',
    ':::',
    'fe80::1%eth0',
    '2130706433',
    '0x7f000001',
    '0177.0.0.1',
  ];
  for (const ip of blocked) assert.equal(isBlockedAddress(ip), true, ip);

  const allowed = [
    '93.184.215.14',
    '8.8.8.8',
    '2606:4700::1111',
    '2001:4860:4860::8888',
    '::ffff:5db8:d70e',
    '::ffff:8.8.8.8',
    '64:ff9b::5db8:d70e',
    '64:ff9b:1:5db8:d7:e00::',
    '2002:5db8:d70e::',
    '172.15.255.255',
    '172.32.0.1',
    '100.128.0.1',
    '192.0.2.1',
    '198.20.0.1',
    '223.255.255.255',
  ];
  for (const ip of allowed) assert.equal(isBlockedAddress(ip), false, ip);
  assert.equal(isPrivateIPv6('::ffff:7f00:1'), true);
  assert.equal(isPrivateIPv6('::ffff:a9fe:a9fe'), true);
  assert.equal(isPrivateIPv6('2606:4700::1111'), false);
  assert.equal(isPrivateIPv4('93.184.215.14'), false);
});

function countingResolver(map4 = {}, map6 = {}) {
  const calls = [];
  return {
    calls,
    resolve4: async (hostname) => {
      calls.push(hostname);
      if (Object.prototype.hasOwnProperty.call(map4, hostname)) return map4[hostname];
      throw new Error('ENOTFOUND');
    },
    resolve6: async (hostname) => {
      calls.push(hostname);
      if (Object.prototype.hasOwnProperty.call(map6, hostname)) return map6[hostname];
      throw new Error('ENOTFOUND');
    },
  };
}

function htmlResult(statusCode, headers, text = '') {
  return {
    statusCode,
    headers,
    body: {
      async *[Symbol.asyncIterator]() {
        if (text) yield Buffer.from(text);
      },
      destroy() {},
    },
  };
}

const blockedLiterals = [
  'http://[::ffff:7f00:1]/',
  'http://[::ffff:127.0.0.1]/',
  'http://[::ffff:a9fe:a9fe]/',
  'http://[::ffff:169.254.169.254]/',
  'http://[::1]/',
  'http://[::]/',
  'http://[fe80::1]/',
  'http://[fd00::1]/',
  'http://[fc00::1]/',
  'http://[64:ff9b::7f00:1]/',
  'http://[::7f00:1]/',
  'http://[2002:7f00:1::]/',
  'http://127.0.0.1/',
  'http://2130706433/',
  'http://0x7f000001/',
  'http://0177.0.0.1/',
  'http://10.0.0.1/',
  'http://169.254.169.254/',
  'http://100.64.0.1/',
  'http://0.0.0.0/',
];

test('audit blocks IP literals and odd IPv4 forms before DNS or fetch', async () => {
  const resolver = countingResolver();
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    throw new Error('fetch');
  });
  for (const url of blockedLiterals) {
    resolver.calls.length = 0;
    fetched.length = 0;
    const result = await audit(url, 'Smith Plumbing', 'plumber', 'Denver');
    assert.equal(result.accessible, false, url);
    assert.match(result.message, /Could not read this site/i);
    assert.equal(resolver.calls.length, 0, url);
    assert.equal(fetched.length, 0, url);
  }
});

test('audit blocks a hostname that resolves to a private or mapped address', async () => {
  const resolver = countingResolver(
    {
      'private-mapped.test': [],
      'private-metadata.test': ['169.254.169.254'],
      'mixed.test': ['93.184.215.14', '10.0.0.1'],
      'garbage.test': ['not-an-ip'],
    },
    {
      'private-mapped.test': ['::ffff:7f00:1'],
      'private-metadata.test': [],
      'mixed.test': [],
      'garbage.test': [],
    },
  );
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    throw new Error('fetch');
  });
  for (const host of ['private-mapped.test', 'private-metadata.test', 'mixed.test', 'garbage.test']) {
    fetched.length = 0;
    const result = await audit(`http://${host}/`, 'Smith Plumbing', 'plumber', 'Denver');
    assert.equal(result.accessible, false, host);
    assert.equal(fetched.length, 0, host);
  }
});

test('pinned lookup returns the checked address and rejects private literals', async () => {
  const resolver = countingResolver({ 'example.com': ['93.184.215.14'] }, { 'example.com': ['2606:4700::1111'] });
  setResolver(resolver);
  const all = await new Promise((resolve, reject) => {
    pinnedLookup('example.com', { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses)));
  });
  assert.deepEqual(all, [
    { address: '93.184.215.14', family: 4 },
    { address: '2606:4700::1111', family: 6 },
  ]);
  const before = resolver.calls.length;
  await assert.rejects(new Promise((resolve, reject) => {
    pinnedLookup('[::ffff:a9fe:a9fe]', { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses)));
  }));
  assert.equal(resolver.calls.length, before);
  const one = await new Promise((resolve, reject) => {
    pinnedLookup('93.184.215.14', {}, (err, address, family) => (err ? reject(err) : resolve({ address, family })));
  });
  assert.deepEqual(one, { address: '93.184.215.14', family: 4 });
  const v6 = await new Promise((resolve, reject) => {
    pinnedLookup('[2606:4700::1111]', {}, (err, address, family) => (err ? reject(err) : resolve({ address, family })));
  });
  assert.deepEqual(v6, { address: '2606:4700::1111', family: 6 });
});

test('audit allows a public IPv4 literal and a public IPv6 literal', async () => {
  const resolver = countingResolver();
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    return htmlResult(200, { 'content-type': 'text/html' }, '<html><title>Example</title></html>');
  });
  for (const url of ['http://93.184.215.14/', 'http://[2606:4700::1111]/']) {
    fetched.length = 0;
    resolver.calls.length = 0;
    const result = await audit(url, 'Example', 'widgets', 'Paris');
    assert.equal(result.accessible, true, url);
    assert.equal(resolver.calls.length, 0, url);
    assert.equal(fetched.length > 0, true, url);
    assert.equal(fetched.every((item) => new URL(item).hostname === new URL(url).hostname), true, url);
  }
});

test('audit re-checks every redirect and blocks a hop to a mapped address', async () => {
  const resolver = countingResolver({ 'public.test': ['93.184.215.14'] }, { 'public.test': [] });
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    return htmlResult(302, { location: 'http://[::ffff:7f00:1]/' });
  });
  const result = await audit('http://public.test/', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.equal(fetched.every((item) => new URL(item).hostname === 'public.test'), true);
  assert.equal(fetched.some((item) => item.includes('7f00')), false);
});

test('audit re-checks a redirect to a hostname that resolves private', async () => {
  const resolver = countingResolver(
    { 'public.test': ['93.184.215.14'], 'private-ipv4.test': ['10.0.0.1'] },
    { 'public.test': [], 'private-ipv4.test': [] },
  );
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    const host = new URL(url).hostname;
    if (host !== 'public.test') throw new Error(`fetched ${host}`);
    return htmlResult(302, { location: 'http://private-ipv4.test/secret' });
  });
  const result = await audit('http://public.test/', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.equal(fetched.every((item) => new URL(item).hostname === 'public.test'), true);
  assert.equal(resolver.calls.includes('private-ipv4.test'), true);
});

test('audit follows a redirect to a public address', async () => {
  const resolver = countingResolver(
    { 'public.test': ['1.1.1.1'], '93.184.215.14': [] },
    {},
  );
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    const host = new URL(url).hostname;
    if (host === 'public.test') return htmlResult(302, { location: 'https://93.184.215.14/landed' });
    if (host === '93.184.215.14') return htmlResult(200, { 'content-type': 'text/html' }, '<html><title>Ok</title></html>');
    throw new Error(`fetched ${host}`);
  });
  const result = await audit('https://public.test/start', 'Example', 'widgets', 'Paris');
  assert.equal(result.accessible, true);
  assert.equal(fetched.some((item) => new URL(item).hostname === '93.184.215.14'), true);
});

test('audit does not follow a non-http redirect', async () => {
  const resolver = countingResolver({ 'public.test': ['93.184.215.14'] }, { 'public.test': [] });
  const fetched = [];
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async (url) => {
    fetched.push(String(url));
    return htmlResult(302, { location: 'file:///etc/passwd' });
  });
  const result = await audit('http://public.test/', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.equal(fetched.every((item) => item.startsWith('http://public.test')), true);
});

test('audit stops after the redirect cap', async () => {
  const resolver = countingResolver({ 'public.test': ['93.184.215.14'] }, { 'public.test': [] });
  let fetched = 0;
  setResolver(resolver);
  resetAgent();
  setRequestForTests(async () => {
    fetched += 1;
    if (fetched > 40) throw new Error('redirect cap failed');
    return htmlResult(302, { location: 'http://public.test/again' });
  });
  const result = await audit('http://public.test/', 'Smith Plumbing', 'plumber', 'Denver');
  assert.equal(result.accessible, false);
  assert.equal(fetched, 16);
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
