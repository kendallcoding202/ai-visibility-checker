// SSRF-safe website audit for local business checks.
import { Agent, request } from 'undici';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

const MAX_REDIRECTS = 3;
const MAX_SIZE = 1024 * 1024;
const TIMEOUT_MS = 10_000;

const PRIVATE_V4 = [
  [0, 0, 0, 0, 8], [10, 0, 0, 0, 8], [100, 64, 0, 0, 10], [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16], [172, 16, 0, 0, 12], [192, 0, 0, 0, 24], [192, 168, 0, 0, 16],
  [198, 18, 0, 0, 15], [224, 0, 0, 0, 4], [240, 0, 0, 0, 4], [255, 255, 255, 255, 32],
];

function ipv4ToNum(ip) {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIPv4(ip) {
  const num = ipv4ToNum(ip) >>> 0;
  for (const [a, b, c, d, bits] of PRIVATE_V4) {
    const net = ((a << 24) + (b << 16) + (c << 8) + d) >>> 0;
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    if ((num & mask) === (net & mask)) return true;
  }
  return false;
}

function isPrivateIPv6(ip) {
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80:')) return true;
  if (ip.startsWith('ff')) return true;
  if (ip.includes('::ffff:')) {
    const v4 = ip.split('::ffff:')[1];
    if (v4 && isIPv4(v4)) return isPrivateIPv4(v4);
  }
  if (ip.startsWith('64:ff9b::')) {
    const tail = ip.replace('64:ff9b::', '');
    const parts = tail.split(':').flatMap((x) => {
      const n = parseInt(x, 16);
      return [n >> 8, n & 0xff];
    });
    if (parts.length >= 4) {
      const v4 = parts.slice(0, 4).join('.');
      return isPrivateIPv4(v4);
    }
  }
  return false;
}

async function resolveAndCheck(hostname) {
  const v4s = await resolve4(hostname).catch(() => []);
  const v6s = await resolve6(hostname).catch(() => []);
  if (v4s.length === 0 && v6s.length === 0) throw new Error('DNS resolution failed');
  for (const ip of v4s) if (isPrivateIPv4(ip)) throw new Error('Private IP blocked');
  for (const ip of v6s) if (isPrivateIPv6(ip)) throw new Error('Private IP blocked');
  return v4s.length > 0 ? v4s[0] : v6s[0];
}

const agent = new Agent({
  connect: {
    lookup: async (hostname, options, callback) => {
      try {
        const ip = await resolveAndCheck(hostname);
        callback(null, ip, isIPv6(ip) ? 6 : 4);
      } catch (err) {
        callback(err);
      }
    },
  },
});

async function safeFetch(url, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) throw new Error('Too many redirects');
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Invalid protocol');
  if (u.username || u.password) throw new Error('Credentials in URL');

  const { statusCode, headers, body } = await request(url, {
    dispatcher: agent,
    method: 'GET',
    headersTimeout: TIMEOUT_MS,
    bodyTimeout: TIMEOUT_MS,
    maxRedirections: 0,
  });

  if (statusCode >= 300 && statusCode < 400 && headers.location) {
    const nextUrl = new URL(headers.location, url).href;
    await resolveAndCheck(new URL(nextUrl).hostname);
    return safeFetch(nextUrl, redirectCount + 1);
  }

  if (statusCode !== 200) {
    body.destroy();
    return { ok: false, status: statusCode, text: '' };
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > MAX_SIZE) {
      body.destroy();
      throw new Error('Response too large');
    }
    chunks.push(chunk);
  }
  return { ok: true, status: statusCode, text: Buffer.concat(chunks).toString('utf-8') };
}

function hasLocalBusinessSchema(html) {
  const ld = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!ld) return false;
  return ld.some((tag) => {
    try {
      const json = JSON.parse(tag.replace(/<\/?script[^>]*>/gi, ''));
      const type = json['@type'] || json.type;
      return type === 'LocalBusiness' || (Array.isArray(type) && type.includes('LocalBusiness'));
    } catch {
      return false;
    }
  });
}

function hasBusinessInfo(html, businessName, city) {
  const text = html.toLowerCase();
  return text.includes(businessName.toLowerCase()) && text.includes(city.toLowerCase());
}

function hasServiceInMeta(html, service, city) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  const text = `${title} ${h1}`.toLowerCase();
  return text.includes(service.toLowerCase()) && text.includes(city.toLowerCase());
}

function hasFAQ(html) {
  if (/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type":\s*"FAQPage"/i.test(html)) return true;
  return /<(details|div)[^>]*class=["'][^"']*faq[^"']*["']/i.test(html);
}

function parseRobotsTxt(text) {
  const blocked = [];
  const allowed = [];
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'];
  for (const bot of bots) {
    const re = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?Disallow:\\s*/`, 'i');
    if (re.test(text)) blocked.push(bot);
    else allowed.push(bot);
  }
  return { blocked, allowed };
}

export async function audit(website, businessName, service, city) {
  if (!website) return { skipped: true, reason: 'No website provided' };

  try {
    const base = new URL(website).origin;
    const [home, robots, llms, sitemap] = await Promise.allSettled([
      safeFetch(`${base}/`),
      safeFetch(`${base}/robots.txt`),
      safeFetch(`${base}/llms.txt`),
      safeFetch(`${base}/sitemap.xml`),
    ]);

    if (home.status === 'rejected' || !home.value.ok) {
      return { accessible: false, message: home.value?.status === 403 ? 'Site returned 403' : 'Could not read this site' };
    }

    const html = home.value.text;
    const robotsTxt = robots.status === 'fulfilled' && robots.value.ok ? robots.value.text : '';
    const robotsStatus = parseRobotsTxt(robotsTxt);

    return {
      accessible: true,
      hasLocalBusinessSchema: hasLocalBusinessSchema(html),
      hasBusinessInfo: hasBusinessInfo(html, businessName, city),
      hasServiceInMeta: hasServiceInMeta(html, service, city),
      hasFAQ: hasFAQ(html),
      robotsBlocked: robotsStatus.blocked,
      robotsAllowed: robotsStatus.allowed,
      hasLlmsTxt: llms.status === 'fulfilled' && llms.value.ok,
      hasSitemap: sitemap.status === 'fulfilled' && sitemap.value.ok,
    };
  } catch (err) {
    return { accessible: false, message: err.message || 'Audit failed' };
  }
}
