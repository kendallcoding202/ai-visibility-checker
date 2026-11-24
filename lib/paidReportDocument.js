// The paid report, as data. Email, the report page, and the PDF all render this.
import { parseAgencyName, stageSummaries, groupByStage, BUYING_STAGES } from './buyingStage.js';
import { runLine } from './publicResult.js';

export const REPORT_FOOTER = 'AI Visibility Checker · aivisibilitychecker.app';

const SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed', 'not_mentioned']);

function clip(value, max) {
  return String(value ?? '').replace(/[\u0000]/g, '').slice(0, max);
}

export function reportDomain(result) {
  const explicit = hostnameOf(result?.domain || result?.website || '');
  if (explicit) return explicit;
  const brand = String(result?.brand ?? '').trim();
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(brand) && brand.length <= 120) return brand.toLowerCase();
  return '';
}

function hostnameOf(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 200 || /[\s<>]/.test(raw)) return '';
  const host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];
  if (!/^[a-z0-9.-]+$/i.test(host) || !host.includes('.') || host.length > 120) return '';
  return host.toLowerCase();
}

export function formatReportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

export function preparedByLine(agency) {
  return agency ? `Prepared by ${agency}` : 'Prepared by AI Visibility Checker';
}

export function mentionLine(row) {
  if (!row?.mentioned) return 'Not mentioned';
  return row.rank ? `Mentioned, #${row.rank}` : 'Mentioned';
}

function answerText(prompt, answers, index) {
  const list = Array.isArray(answers) ? answers : [];
  const match = list.find((item) => item && String(item.prompt ?? '') === prompt && item.text != null);
  const indexed = list[index];
  const indexedOk = indexed && (indexed.prompt == null || indexed.prompt === '' || indexed.prompt === prompt);
  const chosen = match || (indexedOk ? indexed : null);
  return clip(chosen?.text, 12000);
}

export function whatToFix(result) {
  const mentioned = Number(result?.mentionedIn ?? 0);
  const total = Number(result?.total ?? 0);
  if (mentioned < total) {
    return 'To show up in answers that skip you, get listed on the sources ChatGPT cited for those questions. The top cited sources are review sites, directories, and listicles that compare tools in your category.';
  }
  return 'Keep tracking your AI visibility weekly. AI answers change as new content is published and indexed.';
}

export function buildPaidReport({ result, answers, agency } = {}) {
  const parsed = parseAgencyName(agency ?? '');
  if (!parsed.ok) {
    const error = new Error('Invalid agency name');
    error.code = 'agency';
    throw error;
  }
  const brand = clip(result?.brand, 60);
  const rows = (Array.isArray(result?.rows) ? result.rows : []).slice(0, 12).map((row, index) => {
    const prompt = clip(row?.prompt, 300);
    const brands = (Array.isArray(row?.brands) ? row.brands : [])
      .slice(0, 10)
      .map((name) => clip(name, 60).replace(/\s+/g, ' ').trim())
      .filter((name) => name.length >= 2);
    const sentiment = SENTIMENTS.has(row?.sentiment) ? row.sentiment : '';
    return {
      prompt,
      stage: row?.stage,
      mentioned: Boolean(row?.mentioned),
      rank: Number.isFinite(Number(row?.rank)) && Number(row?.rank) > 0 ? Number(row.rank) : null,
      brands,
      sentiment,
      answer: answerText(prompt, answers, index),
    };
  });
  const summaries = stageSummaries(rows, { brand });
  const groups = groupByStage(rows, { brand });
  const sections = BUYING_STAGES.map((stage) => {
    const summary = summaries.find((item) => item.stage === stage);
    return {
      ...summary,
      rows: groups[stage].map((row) => ({
        ...row,
        picks: row.brands.length ? row.brands.slice(0, 6).join(', ') : 'none listed',
        mention: mentionLine(row),
      })),
    };
  });
  return {
    brand: brand || 'your brand',
    category: clip(result?.category, 80),
    domain: reportDomain(result),
    date: formatReportDate(result?.checkedAt),
    agency: parsed.name,
    preparedBy: preparedByLine(parsed.name),
    mentionedIn: Number(result?.mentionedIn ?? 0),
    total: Number(result?.total ?? rows.length),
    score: Number(result?.score ?? 0),
    avgRank: result?.avgRank ?? null,
    runsLine: runLine(result?.runs, result?.total ?? rows.length),
    stages: summaries,
    sections,
    topSources: (Array.isArray(result?.topSources) ? result.topSources : []).slice(0, 6).map((source) => ({
      domain: clip(source?.domain, 120),
      n: Number(source?.n ?? 0),
    })).filter((source) => source.domain),
    whatToFix: whatToFix(result),
    footer: REPORT_FOOTER,
  };
}
