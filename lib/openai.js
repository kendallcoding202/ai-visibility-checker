// OpenAI Responses API helpers (adapted from the AI Search Visibility Tracker actor).
const URL = 'https://api.openai.com/v1/responses';
export const SEARCH_MODEL = process.env.SEARCH_MODEL || 'gpt-5.4-mini';
export const UTILITY_MODEL = process.env.UTILITY_MODEL || 'gpt-5.4-nano';

async function post(body, timeoutMs) {
  const ms = Math.max(1, Math.floor(Number(timeoutMs) || 40_000));
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return res.json();
}

function parse(res) {
  const texts = [], citations = [];
  let searches = 0;
  for (const item of res.output ?? []) {
    if (item.type === 'message') {
      for (const c of item.content ?? []) {
        if (c.type !== 'output_text') continue;
        texts.push(c.text ?? '');
        for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) citations.push({ url: a.url, title: a.title ?? null });
      }
    } else if (item.type === 'web_search_call') searches++;
  }
  return { text: texts.join('\n\n').trim(), citations, usage: res.usage ?? {}, searches };
}

export async function askWithSearch(prompt, timeoutMs, options = {}) {
  const body = {
    model: SEARCH_MODEL, input: prompt, store: false,
    tools: [{ type: 'web_search', search_context_size: 'low', user_location: { type: 'approximate', country: 'US' } }],
    tool_choice: 'auto', max_tool_calls: 1, reasoning: { effort: 'low' },
  };
  if (options.maxOutputTokens) body.max_output_tokens = options.maxOutputTokens;
  return parse(await post(body, timeoutMs));
}

export async function json(prompt, schema, timeoutMs, options = {}) {
  const body = {
    model: UTILITY_MODEL, input: prompt, store: false,
    text: { format: { type: 'json_schema', name: schema.title, schema, strict: true } },
  };
  if (options.maxOutputTokens) body.max_output_tokens = options.maxOutputTokens;
  const r = parse(await post(body, timeoutMs));
  return { data: JSON.parse(r.text), usage: r.usage };
}

// Rough cost in USD. Prices are per 1M tokens; override with env vars if pricing changes.
const P = {
  searchIn: +(process.env.PRICE_SEARCH_IN ?? 0.75), searchOut: +(process.env.PRICE_SEARCH_OUT ?? 4.5),
  utilIn: +(process.env.PRICE_UTIL_IN ?? 0.2), utilOut: +(process.env.PRICE_UTIL_OUT ?? 1.25),
  perSearch: +(process.env.PRICE_PER_SEARCH ?? 0.01),
};
export function costOf(usage, kind, searches = 0) {
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0;
  return kind === 'search'
    ? (i * P.searchIn + o * P.searchOut) / 1e6 + searches * P.perSearch
    : (i * P.utilIn + o * P.utilOut) / 1e6;
}
