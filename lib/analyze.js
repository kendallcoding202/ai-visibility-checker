// Mention matching, adapted from the AI Search Visibility Tracker actor (entities.js).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function findMention(text, name) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${esc(name)}(?![\\p{L}\\p{N}_])`, 'iu');
  const m = re.exec(text);
  return m ? m.index : -1;
}
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };

export const EXTRACTION_SCHEMA = {
  title: 'brand_extraction', type: 'object', additionalProperties: false, required: ['answers'],
  properties: { answers: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['brands', 'sentiment'],
    properties: {
      brands: { type: 'array', items: { type: 'string' } },
      sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed', 'not_mentioned'] },
    },
  } } },
};

export function extractionPrompt(brand, qa) {
  return [
    'You analyze answers written by AI assistants. For EACH numbered answer below, in order, return:',
    '- brands: distinct brand, company or product names the answer recommends or discusses, in the order they first appear. Use the shortest common name (e.g. "HubSpot", not "HubSpot CRM Suite"). Max 20. Exclude generic terms and websites only cited as sources.',
    `- sentiment: the answer's overall sentiment toward "${brand}" (positive, neutral, negative, mixed), or not_mentioned.`,
    '',
    ...qa.map((x, i) => `### ANSWER ${i + 1}\nQUESTION: ${x.prompt}\n${x.text.slice(0, 8000)}\n`),
  ].join('\n');
}

export function buildPrompts(category) {
  return [
    `What are the best ${category} tools right now? Give me a ranked shortlist.`,
    `I'm choosing ${category} software for a small business. Which options would you recommend and why?`,
    `Which ${category} platforms do experts rate highest in 2026?`,
  ];
}
