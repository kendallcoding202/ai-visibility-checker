// Customer-facing email copy. Every message includes an unsubscribe link.

import { originForMail } from './emailAddress.js';
import { runLine } from './publicResult.js';
import { buildPaidReport } from './paidReportDocument.js';
import { trackingTierEnabled, TRACKING_PORTAL_LINK, TRACKING_MANAGE_LINK, TRACKING_UNSUB_LINK } from './trackingTier.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function safeSubject(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function line(label, value) {
  return `${label}: ${value}`;
}

export function confirmEmail({ confirmUrl, unsubUrl }) {
  const subject = 'Confirm your AI visibility report';
  const text = [
    'Confirm this address to receive the AI visibility report.',
    '',
    `Confirm: ${confirmUrl}`,
    '',
    'If you did not ask for this, ignore this email. An unconfirmed address is deleted when this link expires and is opened, or when the same address is submitted again.',
    '',
    `Unsubscribe: ${unsubUrl}`,
    'Privacy: https://aivisibilitychecker.app/privacy',
    '',
    'AI Visibility Checker',
  ].join('\n');
  const html = [
    '<p>Confirm this address to receive the AI visibility report.</p>',
    `<p><a href="${escapeHtml(confirmUrl)}">Confirm my email</a></p>`,
    '<p>If you did not ask for this, ignore this email. An unconfirmed address is deleted when this link expires and is opened, or when the same address is submitted again.</p>',
    `<p><a href="${escapeHtml(unsubUrl)}">Unsubscribe</a></p>`,
    '<p><a href="https://aivisibilitychecker.app/privacy">Privacy policy</a></p>',
    '<p>AI Visibility Checker</p>',
  ].join('');
  return { subject, text, html };
}

function mentionLine(row) {
  if (!row.mentioned) return 'Not mentioned';
  return row.rank ? `Mentioned, #${row.rank}` : 'Mentioned';
}

export function reportEmail({ snapshot, answers, unsubUrl, trackerUrl }) {
  const brand = safeSubject(snapshot.brand) || 'your brand';
  const subject = `AI visibility report for ${brand}`;
  const runs = runLine(snapshot.runs, snapshot.total);
  const questions = (snapshot.rows ?? []).map((row, i) => {
    const picks = (row.brands ?? []).slice(0, 6).join(', ') || 'none listed';
    return `${i + 1}. ${row.prompt}\n${mentionLine(row)}. Top picks: ${picks}`;
  });
  const brands = (snapshot.topBrands ?? []).map((b) => `${b.name} (${b.n})`).join(', ') || 'none listed';
  const sources = (snapshot.topSources ?? []).map((s) => `${s.domain} (${s.n})`).join(', ') || 'none listed';
  const raw = Array.isArray(answers) && answers.length
    ? answers.map((a, i) => `Answer ${i + 1}\n${a.prompt}\n\n${a.text}`).join('\n\n')
    : 'Raw answers from this check were not available for this email. They stay with the browser that ran the check.';
  const text = [
    line('Brand', snapshot.brand),
    snapshot.category ? line('Category', snapshot.category) : 'Category: brand-only check',
    line('Mentioned', `${snapshot.mentionedIn} of ${snapshot.total} answers`),
    line('Score', `${snapshot.score}/100`),
    snapshot.avgRank ? line('Average position when mentioned', snapshot.avgRank) : 'Average position when mentioned: not mentioned',
    runs,
    '',
    'Questions',
    ...questions,
    '',
    `Other brands named: ${brands}`,
    `Cited sources: ${sources}`,
    '',
    'Raw answers',
    raw,
    '',
    trackingTierEnabled()
      ? 'Weekly re-checks of this saved brand on ChatGPT with web search are $24/month. Each result includes the run count and the raw answers. Cancel anytime.'
      : 'This email is the report for this check.',
    '',
    `Ongoing tracking is the AI Visibility Tracker on the Apify Store, $0.0375 per answer on the Free tier: ${trackerUrl}`,
    '',
    `Unsubscribe: ${unsubUrl}`,
    'Privacy: https://aivisibilitychecker.app/privacy',
  ].join('\n');
  const html = [
    `<p><strong>${escapeHtml(snapshot.brand)}</strong> was mentioned in ${escapeHtml(snapshot.mentionedIn)} of ${escapeHtml(snapshot.total)} answers. Score: ${escapeHtml(snapshot.score)}/100.</p>`,
    `<p>${escapeHtml(runs)}</p>`,
    '<h2>Questions</h2>',
    '<ol>',
    ...(snapshot.rows ?? []).map((row) => `<li>${escapeHtml(row.prompt)}<br>${escapeHtml(mentionLine(row))}</li>`),
    '</ol>',
    `<p>Other brands named: ${escapeHtml(brands)}</p>`,
    `<p>Cited sources: ${escapeHtml(sources)}</p>`,
    '<h2>Raw answers</h2>',
    `<pre>${escapeHtml(raw)}</pre>`,
    trackingTierEnabled()
      ? '<p>Weekly re-checks of this saved brand on ChatGPT with web search are $24/month. Each result includes the run count and the raw answers. Cancel anytime.</p>'
      : '<p>This email is the report for this check.</p>',
    `<p>Ongoing tracking is the <a href="${escapeHtml(trackerUrl)}">AI Visibility Tracker</a> on the Apify Store, $0.0375 per answer on the Free tier.</p>`,
    `<p><a href="${escapeHtml(unsubUrl)}">Unsubscribe</a> · <a href="https://aivisibilitychecker.app/privacy">Privacy policy</a></p>`,
  ].join('');
  return { subject, text, html };
}

function safeReportLink(url) {
  try {
    const parsed = new URL(String(url ?? ''));
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/paid-report') return '';
    if (!originForMail(parsed.host)) return '';
    if (!parsed.searchParams.get('token')) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function paidReportEmail({ snapshot, answers, pdfUrl }) {
  const doc = buildPaidReport({ result: snapshot, answers });
  const brand = safeSubject(doc.brand) || 'your brand';
  const subject = `Your AI visibility report for ${brand}`;
  const link = safeReportLink(pdfUrl);
  const sources = doc.topSources.length
    ? doc.topSources.map((source) => `${source.domain} (${source.n})`).join(', ')
    : 'none listed';
  const stageBlocks = doc.sections.flatMap((section) => {
    const body = section.rows.length
      ? section.rows.map((row, index) => `${index + 1}. ${row.prompt}\n${row.mention}. Top picks: ${row.picks}${row.answer ? `\n\n${row.answer}` : ''}`)
      : ['No prompts in this stage.'];
    return [section.label, ...body, ''];
  });
  const text = [
    'Your AI visibility report',
    '',
    doc.preparedBy,
    line('Brand', doc.brand),
    doc.category ? line('Market', doc.category) : 'Market: brand-only check',
    doc.domain ? line('Domain', doc.domain) : null,
    doc.date ? line('Date', doc.date) : null,
    line('Mentioned', `${doc.mentionedIn} of ${doc.total} answers`),
    line('Score', `${doc.score}/100`),
    doc.avgRank ? line('Average position when mentioned', doc.avgRank) : 'Average position when mentioned: not mentioned',
    doc.runsLine,
    '',
    'Buying stages',
    ...doc.stages.map((stage) => stage.line),
    '',
    ...stageBlocks,
    'Cited sources',
    sources,
    '',
    'What to fix',
    doc.whatToFix,
    '',
    link ? `Download the PDF: ${link}` : null,
    link ? 'You can add an agency name on that page. It is printed as Prepared by.' : null,
    'Thank you for your purchase. This is a one-time report with no subscription.',
    doc.footer,
    'Privacy: https://aivisibilitychecker.app/privacy',
  ].filter((part) => part != null).join('\n');
  const html = [
    '<h1>Your AI visibility report</h1>',
    `<p>${escapeHtml(doc.preparedBy)}</p>`,
    `<p><strong>${escapeHtml(doc.brand)}</strong>${doc.domain ? ` · ${escapeHtml(doc.domain)}` : ''}${doc.date ? ` · ${escapeHtml(doc.date)}` : ''}</p>`,
    `<p>${escapeHtml(doc.brand)} was mentioned in ${escapeHtml(doc.mentionedIn)} of ${escapeHtml(doc.total)} answers. Score: ${escapeHtml(doc.score)}/100.</p>`,
    `<p>${escapeHtml(doc.runsLine)}</p>`,
    '<h2>Buying stages</h2>',
    '<ul>',
    ...doc.stages.map((stage) => `<li>${escapeHtml(stage.line)}</li>`),
    '</ul>',
    ...doc.sections.flatMap((section) => [
      `<h2>${escapeHtml(section.label)}</h2>`,
      section.rows.length ? '' : '<p>No prompts in this stage.</p>',
      ...section.rows.map((row) => [
        `<p><strong>${escapeHtml(row.prompt)}</strong><br>${escapeHtml(row.mention)}<br>Top picks: ${escapeHtml(row.picks)}</p>`,
        row.answer ? `<pre>${escapeHtml(row.answer)}</pre>` : '',
      ].join('')),
    ]),
    `<p>Cited sources: ${escapeHtml(sources)}</p>`,
    '<h2>What to fix</h2>',
    `<p>${escapeHtml(doc.whatToFix)}</p>`,
    link ? `<p><a href="${escapeHtml(link)}">Download the PDF</a></p>` : '',
    '<p>Thank you for your purchase. This is a one-time report with no subscription.</p>',
    `<p>${escapeHtml(doc.footer)}</p>`,
    '<p><a href="https://aivisibilitychecker.app/privacy">Privacy policy</a></p>',
  ].filter(Boolean).join('');
  return { subject, text, html };
}

export function trackingEmail({ snapshot, answers, runNumber, unsubUrl, manageUrl, portalUrl }) {
  const brand = safeSubject(snapshot.brand) || 'your brand';
  const subject = `Weekly ChatGPT check for ${brand}`;
  const runs = runLine(snapshot.runs, snapshot.total);
  const count = Number(runNumber) > 0 ? Number(runNumber) : 1;
  const questions = (snapshot.rows ?? []).map((row, i) => {
    const picks = (row.brands ?? []).slice(0, 6).join(', ') || 'none listed';
    return `${i + 1}. ${row.prompt}\n${mentionLine(row)}. Top picks: ${picks}`;
  });
  const raw = Array.isArray(answers) && answers.length
    ? answers.map((a, i) => `Answer ${i + 1}\n${a.prompt}\n\n${a.text}`).join('\n\n')
    : 'Raw answers from this run were not stored.';
  const text = [
    `Weekly run ${count} for ${snapshot.brand}.`,
    '$24/month. One saved brand, re-checked on ChatGPT with web search.',
    runs,
    '',
    'Questions',
    ...questions,
    '',
    'Raw answers',
    raw,
    '',
    `${TRACKING_PORTAL_LINK}. Cancel anytime: ${portalUrl}`,
    `${TRACKING_MANAGE_LINK}: ${manageUrl}`,
    `${TRACKING_UNSUB_LINK}: ${unsubUrl}`,
    'Privacy: https://aivisibilitychecker.app/privacy',
  ].join('\n');
  const html = [
    `<p><strong>${escapeHtml(snapshot.brand)}</strong> weekly run ${escapeHtml(count)}. $24/month. One saved brand, re-checked on ChatGPT with web search.</p>`,
    `<p>${escapeHtml(runs)}</p>`,
    '<h2>Raw answers</h2>',
    `<pre>${escapeHtml(raw)}</pre>`,
    `<p><a href="${escapeHtml(portalUrl)}">${TRACKING_PORTAL_LINK}</a></p>`,
    `<p><a href="${escapeHtml(manageUrl)}">${TRACKING_MANAGE_LINK}</a></p>`,
    `<p><a href="${escapeHtml(unsubUrl)}">${TRACKING_UNSUB_LINK}</a></p>`,
    '<p><a href="https://aivisibilitychecker.app/privacy">Privacy policy</a></p>',
  ].join('');
  return { subject, text, html };
}
