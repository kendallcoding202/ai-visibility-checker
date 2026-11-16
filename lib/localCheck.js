// Input validation and prompts for local service business checks.

const FIELD = /^[\p{L}\p{N} .,&'+\-/()!]+$/u;
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

export function cleanField(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f<>{}\[\]`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanWebsite(value) {
  const s = String(value ?? '').trim().slice(0, 200);
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !s.startsWith('http://') && !s.startsWith('https://')) {
    return '';
  }
  try {
    const urlStr = s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`;
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.username || u.password) return '';
    return u.href;
  } catch {
    return '';
  }
}

export function parseLocalInput(body) {
  const rawBusinessName = String(body?.businessName ?? '').trim();
  const rawService = String(body?.service ?? '').trim();
  const rawCity = String(body?.city ?? '').trim();
  const state = String(body?.state ?? '').trim().toUpperCase();

  if (rawBusinessName.length < 2) return { error: 'Enter a business name.' };
  if (rawService.length < 2) return { error: 'Enter a service (e.g., dentist, plumber).' };
  if (rawCity.length < 2) return { error: 'Enter a city.' };
  if (!US_STATES.has(state)) return { error: 'Select a valid US state.' };

  const fields = [rawBusinessName, rawService, rawCity];
  if (!fields.every((s) => FIELD.test(s))) return { error: 'Please use plain letters and numbers only.' };

  const businessName = cleanField(rawBusinessName, 60);
  const service = cleanField(rawService, 60);
  const city = cleanField(rawCity, 60);
  const website = cleanWebsite(body?.website);

  return { businessName, service, city, state, website };
}

export function buildLocalPrompts(service, city, state, businessName) {
  return [
    `Who are the best ${service} companies in ${city}, ${state}? Give me a ranked shortlist.`,
    `I need ${service} in ${city}. Who should I call? Recommend specific local businesses.`,
    `Which ${service} businesses do people in ${city}, ${state} recommend most in 2026?`,
  ];
}

export function localExtractionPrompt(businessName, qa) {
  return [
    'You analyze answers written by AI assistants. For EACH numbered answer below, in order, return:',
    '- brands: distinct business names the answer recommends or discusses, in the order they first appear. Use the exact name from the answer. Max 20. Exclude generic terms and websites only cited as sources.',
    `- sentiment: the answer's overall sentiment toward "${businessName}" (positive, neutral, negative, mixed), or not_mentioned.`,
    '',
    ...qa.map((x, i) => `### ANSWER ${i + 1}\nQUESTION: ${x.prompt}\n${x.text.slice(0, 8000)}\n`),
  ].join('\n');
}

export function normalizeWebsite(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname}${u.search}`.slice(0, 200);
  } catch {
    return '';
  }
}
