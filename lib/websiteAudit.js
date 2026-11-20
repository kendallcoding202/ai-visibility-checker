// SSRF-safe website audit for local business checks.
// One classifier covers IP literals and every DNS answer. Undici's lookup
// connects to those checked addresses, so a name cannot rebind to another IP.
import { Agent, request as undiciRequest } from 'undici';
import { resolve4, resolve6 } from 'node:dns/promises';
import { BlockList, isIP, isIPv4 } from 'node:net';
import { hasLocalBusinessSchema, hasFaqPageSchema } from './structuredData.js';

const MAX_REDIRECTS = 3;
const MAX_SIZE = 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'AIVisibilityChecker/1.0 (+https://aivisibilitychecker.app)';
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xml', 'application/json'];

const blockList = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  blockList.addSubnet(network, prefix, 'ipv4');
}
blockList.addAddress('255.255.255.255', 'ipv4');
blockList.addAddress('::', 'ipv6');
blockList.addAddress('::1', 'ipv6');
// ::/96 is deprecated IPv4-compatible space. Block the whole prefix.
blockList.addSubnet('::', 96, 'ipv6');
blockList.addSubnet('fc00::', 7, 'ipv6');
blockList.addSubnet('fe80::', 10, 'ipv6');
blockList.addSubnet('fec0::', 10, 'ipv6');
blockList.addSubnet('ff00::', 8, 'ipv6');
blockList.addSubnet('2001:db8::', 32, 'ipv6');

function normalizeHost(value) {
  let host = String(value ?? '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

// WHATWG URL already rewrites decimal, hex, octal, and short IPv4 (2130706433,
// 0x7f000001, 0177.0.0.1, 127.1) to a dotted quad before this runs. This still
// rejects those forms if a hostname reaches the resolver without that rewrite.
function isObfuscatedIPv4(host) {
  if (/^0x[0-9a-f]+$/.test(host)) return true;
  if (/^\d+$/.test(host)) return true;
  const parts = host.split('.');
  if (parts.length >= 2 && parts.length <= 4 && parts.every((part) => /^(0x[0-9a-f]+|\d+)$/.test(part)) && !isIPv4(host)) {
    return true;
  }
  return false;
}

function parseIPv6Hextets(ip) {
  let text = ip.toLowerCase();
  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':');
    const tail = lastColon === -1 ? '' : text.slice(lastColon + 1);
    if (!isIPv4(tail)) return null;
    const [a, b, c, d] = tail.split('.').map((part) => Number(part));
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  if (text.includes(':::')) return null;
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 && missing < 1) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const hextets = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    hextets.push(parseInt(group, 16));
  }
  return hextets;
}

function hextetsToV4(high, low) {
  return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join('.');
}

// Mapped, NAT64, and 6to4 carry an IPv4 address. Check that address.
// Other IPv6 is classified by the block list, including all of ::/96.
function embeddedV4(hextets) {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets;
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff) {
    return { v4: hextetsToV4(h6, h7) };
  }
  if (h0 === 0x64 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return { v4: hextetsToV4(h6, h7) };
  }
  // 64:ff9b:1::/48, RFC 6052 prefix length 48. The u byte must be 0.
  if (h0 === 0x64 && h1 === 0xff9b && h2 === 0x0001) {
    const u = (h4 >> 8) & 0xff;
    if (u !== 0) return { invalid: true };
    return { v4: [(h3 >> 8) & 0xff, h3 & 0xff, h4 & 0xff, (h5 >> 8) & 0xff].join('.') };
  }
  if (h0 === 0x2002) return { v4: hextetsToV4(h1, h2) };
  return null;
}

function blockedIPv6(host) {
  const hextets = parseIPv6Hextets(host);
  if (!hextets) return true;
  const embedded = embeddedV4(hextets);
  if (embedded) {
    if (embedded.invalid || !isIPv4(embedded.v4)) return true;
    return blockList.check(embedded.v4, 'ipv4');
  }
  return blockList.check(host, 'ipv6');
}

// True for private, reserved, and unparseable addresses. Fail closed.
export function isBlockedAddress(address) {
  const host = normalizeHost(address);
  if (!host || host.includes('%') || host.includes('/') || /\s/.test(host)) return true;
  try {
    const family = isIP(host);
    if (family === 4) return blockList.check(host, 'ipv4');
    if (family === 6) return blockedIPv6(host);
    return true;
  } catch {
    return true;
  }
}

export function isPrivateIPv4(ip) {
  const host = normalizeHost(ip);
  return isIP(host) === 4 && isBlockedAddress(host);
}

export function isPrivateIPv6(ip) {
  const host = normalizeHost(ip);
  return isIP(host) === 6 && isBlockedAddress(host);
}

function isDnsHostname(host) {
  if (!host || host.length > 253 || host.includes('..')) return false;
  return /^[a-z0-9._-]+$/.test(host);
}

let resolver = { resolve4, resolve6 };

export function setResolver(customResolver) {
  resolver = customResolver;
}

async function resolveAndCheck(hostname) {
  const v4s = await Promise.resolve()
    .then(() => resolver.resolve4(hostname))
    .catch(() => []);
  const v6s = await Promise.resolve()
    .then(() => resolver.resolve6(hostname))
    .catch(() => []);
  if (!Array.isArray(v4s) || !Array.isArray(v6s)) throw new Error('DNS resolution failed');
  const ips = [...v4s, ...v6s];
  if (ips.length === 0) throw new Error('DNS resolution failed');
  const results = [];
  for (const ip of ips) {
    if (typeof ip !== 'string' || isBlockedAddress(ip)) throw new Error('Private IP blocked');
    const family = isIP(normalizeHost(ip));
    if (family !== 4 && family !== 6) throw new Error('Private IP blocked');
    results.push({ address: normalizeHost(ip), family });
  }
  return results;
}

export async function addressesForHost(hostname) {
  const host = normalizeHost(hostname);
  if (!host || host.includes('%') || host.includes('/') || /\s/.test(host)) {
    throw new Error('Private IP blocked');
  }
  if (isObfuscatedIPv4(host)) throw new Error('Private IP blocked');
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new Error('Private IP blocked');
    return [{ address: host, family: isIP(host) }];
  }
  if (!isDnsHostname(host)) throw new Error('Private IP blocked');
  return resolveAndCheck(host);
}

export function pinnedLookup(hostname, options, callback) {
  addressesForHost(hostname).then((results) => {
    if (!results.length) {
      callback(new Error('DNS resolution failed'));
      return;
    }
    if (options && options.all) callback(null, results);
    else callback(null, results[0].address, results[0].family);
  }, (err) => callback(err));
}

function createAgent() {
  return new Agent({
    connect: {
      lookup: pinnedLookup,
    },
  });
}

let agent = createAgent();
let performRequest = undiciRequest;

export function resetAgent() {
  agent = createAgent();
}

export function setRequestForTests(fn) {
  performRequest = fn;
}

export function resetRequestForTests() {
  performRequest = undiciRequest;
}

async function assertTarget(urlString) {
  let target;
  try {
    target = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('Invalid protocol');
  if (target.username || target.password) throw new Error('Credentials in URL');
  if (!target.hostname) throw new Error('Invalid URL');
  // Any TCP port stays allowed. That is the existing port policy.
  await addressesForHost(target.hostname);
  return target;
}

async function safeFetch(url, redirectCount = 0, signal = null) {
  if (redirectCount > MAX_REDIRECTS) throw new Error('Too many redirects');
  const target = await assertTarget(url);
  const abortSignal = signal || AbortSignal.timeout(TIMEOUT_MS);

  const { statusCode, headers, body } = await performRequest(target.href, {
    dispatcher: agent,
    method: 'GET',
    signal: abortSignal,
    maxRedirections: 0,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': ALLOWED_CONTENT_TYPES.join(', '),
    },
  });

  if (statusCode >= 300 && statusCode < 400 && headers.location) {
    body.destroy();
    if (typeof headers.location !== 'string') throw new Error('Invalid redirect');
    let nextUrl;
    try {
      nextUrl = new URL(headers.location, target.href).href;
    } catch {
      throw new Error('Invalid redirect');
    }
    return safeFetch(nextUrl, redirectCount + 1, abortSignal);
  }

  if (statusCode !== 200) {
    body.destroy();
    return { ok: false, status: statusCode, text: '' };
  }

  const contentType = headers['content-type'] || '';
  const matchesType = ALLOWED_CONTENT_TYPES.some((t) => contentType.toLowerCase().includes(t));
  if (!matchesType) {
    body.destroy();
    return { ok: false, status: 415, text: '' };
  }

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      size += chunk.length;
      if (size > MAX_SIZE) {
        body.destroy();
        throw new Error('Response too large');
      }
      chunks.push(chunk);
    }
    return { ok: true, status: statusCode, text: Buffer.concat(chunks).toString('utf-8') };
  } catch (err) {
    body.destroy();
    throw err;
  }
}

// hasLocalBusinessSchema lives in structuredData.js: it accepts LocalBusiness
// and every schema.org subtype (Dentist, Plumber, ProfessionalService...),
// in @graph and top-level arrays too. It used to accept only the literal
// "LocalBusiness", so real local sites were told their markup was missing.

function hasBusinessName(html, businessName) {
  const text = html.toLowerCase();
  return text.includes(businessName.toLowerCase());
}

function hasPhoneNumber(html) {
  const phonePattern = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
  return phonePattern.test(html);
}

function hasAddress(html) {
  const streetSuffixes = /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl|circle|cir)\b/i;
  const zipPattern = /\b\d{5}(-\d{4})?\b/;
  if (streetSuffixes.test(html) && zipPattern.test(html)) return true;
  if (/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"PostalAddress"/i.test(html)) return true;
  return false;
}

function hasServiceInMeta(html, service, city) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]);
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1]);
  const stripTags = (s) => s.replace(/<[^>]*>/g, ' ');
  const text = [title, ...h1s, ...h2s].map(stripTags).join(' ').toLowerCase();
  return text.includes(service.toLowerCase()) && text.includes(city.toLowerCase());
}

function hasFAQ(html) {
  // Structured: an FAQPage entity anywhere (@graph, arrays, full-URL types).
  if (hasFaqPageSchema(html)) return true;
  // The original text match stays as a fallback, so no page that passed
  // before can fail now (it also catches FAQPage in a block that won't parse).
  if (/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type":\s*"FAQPage"/i.test(html)) return true;
  return /<(details|div)[^>]*class=["'][^"']*faq[^"']*["']/i.test(html);
}

function parseRobotsTxt(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const groups = [];
  let currentGroup = { agents: [], rules: [] };
  
  for (const line of lines) {
    if (/^User-agent:/i.test(line)) {
      const agent = line.replace(/^User-agent:\s*/i, '').trim();
      if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
        groups.push(currentGroup);
        currentGroup = { agents: [], rules: [] };
      }
      currentGroup.agents.push(agent.toLowerCase());
    } else if (/^(Disallow|Allow):/i.test(line)) {
      currentGroup.rules.push(line);
    }
  }
  if (currentGroup.agents.length > 0 || currentGroup.rules.length > 0) {
    groups.push(currentGroup);
  }

  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
  const blocked = [];
  const allowed = [];

  for (const bot of bots) {
    const botLower = bot.toLowerCase();
    const botGroup = groups.find((g) => g.agents.includes(botLower));
    const wildcardGroup = groups.find((g) => g.agents.includes('*'));
    const group = botGroup || wildcardGroup;
    
    if (!group) {
      allowed.push(bot);
      continue;
    }

    const hasDisallowRoot = group.rules.some((r) => /^Disallow:\s*\/\s*$/i.test(r));
    const hasAllowRoot = group.rules.some((r) => /^Allow:\s*\/\s*$/i.test(r));
    
    if (hasDisallowRoot && !hasAllowRoot) {
      blocked.push(bot);
    } else {
      allowed.push(bot);
    }
  }

  return { blocked, allowed };
}

export async function audit(website, businessName, service, city) {
  if (!website) return { skipped: true, reason: 'No website provided' };

  try {
    const base = new URL(website);
    if (base.username || base.password) return { accessible: false, message: 'Could not read this site' };
    if (base.protocol !== 'http:' && base.protocol !== 'https:') {
      return { accessible: false, message: 'Could not read this site' };
    }
    const normalizedBase = `${base.protocol}//${base.hostname}`;
    const [home, robots, llms, sitemap] = await Promise.allSettled([
      safeFetch(`${normalizedBase}/`),
      safeFetch(`${normalizedBase}/robots.txt`),
      safeFetch(`${normalizedBase}/llms.txt`),
      safeFetch(`${normalizedBase}/sitemap.xml`),
    ]);

    if (home.status === 'rejected' || !home.value.ok) {
      return { accessible: false, message: 'Could not read this site' };
    }

    const html = home.value.text;
    const robotsTxt = robots.status === 'fulfilled' && robots.value.ok ? robots.value.text : '';
    const robotsStatus = parseRobotsTxt(robotsTxt);

    return {
      accessible: true,
      hasLocalBusinessSchema: hasLocalBusinessSchema(html),
      hasBusinessName: hasBusinessName(html, businessName),
      hasPhoneNumber: hasPhoneNumber(html),
      hasAddress: hasAddress(html),
      hasServiceInMeta: hasServiceInMeta(html, service, city),
      hasFAQ: hasFAQ(html),
      robotsBlocked: robotsStatus.blocked,
      robotsAllowed: robotsStatus.allowed,
      hasLlmsTxt: llms.status === 'fulfilled' && llms.value.ok,
      hasSitemap: sitemap.status === 'fulfilled' && sitemap.value.ok,
    };
  } catch (err) {
    return { accessible: false, message: 'Could not read this site' };
  }
}
