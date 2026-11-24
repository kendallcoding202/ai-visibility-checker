import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPrompts, buildStagedPrompts, templateStage } from './analyze.js';
import {
  AGENCY_ERROR, classifyBuyingStage, coerceStage, groupByStage, isBuyingStage, parseAgencyName, stageSummaries,
} from './buyingStage.js';
import { buildPaidReport } from './paidReportDocument.js';
import { paidReportEmail } from './emailCopy.js';
import { PAID_REPORT_PRICE } from './paidReport.js';
import PaidReportView from '../app/PaidReportView.js';

const learn = 'What is project management software?';
const compare = 'What are the best project management tools right now? Give me a ranked shortlist.';
const buy = 'Northstar pricing';

const oldResult = {
  brand: 'Northstar',
  category: 'project management',
  domain: 'https://www.northstar.example/pricing',
  mentionedIn: 2,
  total: 3,
  score: 55,
  avgRank: 1.5,
  runs: 1,
  checkedAt: '2026-11-24T15:00:00.000Z',
  topSources: [{ domain: 'g2.com', n: 2 }],
  rows: [
    { prompt: learn, mentioned: false, brands: ['Asana'] },
    { prompt: compare, mentioned: true, rank: 2, brands: ['Asana', 'Northstar', 'Monday.com'] },
    { prompt: buy, mentioned: true, rank: 1, brands: ['Northstar', 'Asana', 'monday AI Work Platform'] },
  ],
};

const oldAnswers = [
  { prompt: learn, text: 'Project management software helps teams plan work.' },
  { prompt: compare, text: 'Asana and Northstar lead. <script>alert(1)</script>' },
  { text: 'Northstar costs $12 per user.' },
];

function section(html, heading) {
  const marker = `<h2>${heading}</h2>`;
  const start = html.indexOf(marker);
  assert.equal(start > -1, true, heading);
  const rest = html.slice(start + marker.length);
  const next = rest.indexOf('<h2>');
  return next === -1 ? rest : rest.slice(0, next);
}

test('generator templates are tagged compare and keyword rules agree', () => {
  for (const [category, brand] of [['project management', 'Notion'], ['', 'Notion'], ['CRM', 'HubSpot']]) {
    const staged = buildStagedPrompts(category, brand);
    assert.equal(staged.length, 3);
    assert.deepEqual(buildPrompts(category, brand), staged.map((item) => item.prompt));
    for (const item of staged) {
      assert.equal(isBuyingStage(item.stage), true);
      assert.equal(item.stage, 'compare');
      assert.equal(templateStage(item.prompt), 'compare');
      assert.equal(classifyBuyingStage(item.prompt, { brand }), 'compare');
      assert.equal(coerceStage(item.stage, item.prompt, brand), 'compare');
    }
  }
});

test('keyword rules classify learn, compare, and buy', () => {
  assert.equal(classifyBuyingStage('What is a CRM?'), 'learn');
  assert.equal(classifyBuyingStage('How to choose a CRM for a small team'), 'learn');
  assert.equal(classifyBuyingStage("What's a knowledge base?"), 'learn');
  assert.equal(classifyBuyingStage('Tell me about CRMs'), 'learn');

  assert.equal(classifyBuyingStage('best CRM tools'), 'compare');
  assert.equal(classifyBuyingStage('Asana vs Monday'), 'compare');
  assert.equal(classifyBuyingStage('Asana vs. Monday'), 'compare');
  assert.equal(classifyBuyingStage('Asana versus Monday'), 'compare');
  assert.equal(classifyBuyingStage('alternatives to Notion'), 'compare');
  assert.equal(classifyBuyingStage('What are alternatives to Notion?'), 'compare');
  assert.equal(classifyBuyingStage('Which products do experts compare with Notion in 2026?'), 'compare');

  assert.equal(classifyBuyingStage('HubSpot pricing'), 'buy');
  assert.equal(classifyBuyingStage('buy Notion'), 'buy');
  assert.equal(classifyBuyingStage('plumbers near me'), 'buy');
  assert.equal(classifyBuyingStage('sign up for Slack'), 'buy');
  assert.equal(classifyBuyingStage('sign-up for Slack'), 'buy');
  assert.equal(classifyBuyingStage('What is the price of HubSpot?'), 'buy');
  assert.equal(classifyBuyingStage('best HubSpot pricing'), 'buy');
  assert.equal(classifyBuyingStage('How to sign up for HubSpot'), 'buy');
});

test('a validated generation tag wins, and a bad tag falls back', () => {
  assert.equal(coerceStage('buy', 'What is a CRM?', 'HubSpot'), 'buy');
  assert.equal(coerceStage('BUY', 'What is a CRM?', 'HubSpot'), 'buy');
  assert.equal(coerceStage('nope', 'What is a CRM?', 'HubSpot'), 'learn');
  assert.equal(coerceStage('', compare, 'Northstar'), 'compare');
  assert.equal(coerceStage(undefined, buy, 'Northstar'), 'buy');
});

test('grouping and summaries count mentions and competitors', () => {
  const rows = [
    { prompt: learn, mentioned: false, brands: ['Asana', 'Asana'] },
    { prompt: compare, mentioned: true, brands: ['Asana', 'Northstar', 'Monday.com'] },
    { prompt: 'Asana vs Monday.com', mentioned: false, brands: ['monday AI Work Platform', 'ClickUp'] },
    { prompt: buy, mentioned: true, brands: ['Northstar', 'Asana'] },
    { stage: 'learn', prompt: 'best tools that were tagged learn', mentioned: false, brands: [] },
  ];
  const groups = groupByStage(rows, { brand: 'Northstar' });
  assert.deepEqual(groups.learn.map((row) => row.prompt), [learn, 'best tools that were tagged learn']);
  assert.deepEqual(groups.compare.map((row) => row.prompt), [compare, 'Asana vs Monday.com']);
  assert.deepEqual(groups.buy.map((row) => row.prompt), [buy]);

  const summaries = stageSummaries(rows, { brand: 'Northstar' });
  const byStage = Object.fromEntries(summaries.map((item) => [item.stage, item]));
  assert.equal(byStage.learn.prompts, 2);
  assert.equal(byStage.learn.mentioned, 0);
  assert.deepEqual(byStage.learn.topCompetitors, [{ name: 'Asana', n: 1 }]);
  assert.equal(byStage.compare.prompts, 2);
  assert.equal(byStage.compare.mentioned, 1);
  assert.deepEqual(byStage.compare.topCompetitors, [
    { name: 'Monday.com', n: 2 },
    { name: 'Asana', n: 1 },
    { name: 'ClickUp', n: 1 },
  ]);
  assert.equal(byStage.buy.mentioned, 1);
  assert.deepEqual(byStage.buy.topCompetitors, [{ name: 'Asana', n: 1 }]);
  assert.match(byStage.compare.line, /Compare: 2 prompts, 1 of 2 mention the brand/);
  assert.match(byStage.compare.line, /Monday\.com \(2\)/);
});

test('old reports with no stage still group, and the view escapes answers', () => {
  const doc = buildPaidReport({ result: oldResult, answers: oldAnswers });
  assert.equal(doc.domain, 'northstar.example');
  assert.equal(doc.date, '24 Nov 2026');
  assert.equal(doc.preparedBy, 'Prepared by AI Visibility Checker');
  assert.deepEqual(doc.sections.map((sectionItem) => [sectionItem.stage, sectionItem.rows.map((row) => row.prompt)]), [
    ['learn', [learn]],
    ['compare', [compare]],
    ['buy', [buy]],
  ]);
  assert.equal(doc.sections[1].rows[0].answer.includes('<script>'), true);
  assert.equal(doc.sections[2].rows[0].answer, 'Northstar costs $12 per user.');

  const token = 'a'.repeat(43);
  const html = renderToStaticMarkup(createElement(PaidReportView, { doc, token }));
  assert.equal(section(html, 'Learn').includes(learn), true);
  assert.equal(section(html, 'Learn').includes(buy), false);
  assert.equal(section(html, 'Compare').includes('best project management tools'), true);
  assert.equal(section(html, 'Buy').includes('Northstar pricing'), true);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Kovyr'), false);
  assert.equal(html.includes('Apify'), false);
  assert.equal(html.includes(PAID_REPORT_PRICE), false);
  const visible = html.replace(/<input[^>]*>/g, '');
  assert.equal(visible.includes(token), false);

  const message = paidReportEmail({ snapshot: oldResult, answers: oldAnswers, pdfUrl: 'javascript:alert(1)' });
  assert.equal(message.text.includes('Buying stages'), true);
  assert.equal(message.html.includes('<h2>Learn</h2>'), true);
  assert.equal(message.html.includes('<h2>Compare</h2>'), true);
  assert.equal(message.html.includes('<h2>Buy</h2>'), true);
  assert.equal(message.html.includes('<script>'), false);
  assert.equal(message.html.includes('javascript:'), false);
  assert.equal(message.text.includes('javascript:'), false);
  assert.equal(message.html.includes('Kovyr'), false);
  assert.equal(message.html.includes('Apify'), false);
  assert.match(message.subject, /Northstar/);
  assert.equal(/[\r\n]/.test(message.subject), false);
});

test('agency names are plain text, at most 80 characters', () => {
  assert.deepEqual(parseAgencyName(''), { ok: true, name: '' });
  assert.deepEqual(parseAgencyName(null), { ok: true, name: '' });
  assert.deepEqual(parseAgencyName('  Northstar & Co.  '), { ok: true, name: 'Northstar & Co.' });
  assert.deepEqual(parseAgencyName('Café Agency'), { ok: true, name: 'Café Agency' });
  assert.equal(parseAgencyName('A'.repeat(80)).ok, true);
  assert.equal(parseAgencyName('A'.repeat(81)).ok, false);
  assert.equal(parseAgencyName('A'.repeat(81)).error, AGENCY_ERROR);
  assert.equal(parseAgencyName('line\nbreak').ok, false);
  assert.equal(parseAgencyName('bad\u0000name').ok, false);
  assert.equal(parseAgencyName('<script>').ok, false);
  assert.equal(parseAgencyName('javascript:alert(1)').ok, false);
  assert.equal(parseAgencyName('Agency "quoted"').ok, false);
  assert.equal(parseAgencyName(12).ok, false);
  assert.throws(() => buildPaidReport({ result: oldResult, agency: '<script>' }), /Invalid agency name/);
});

test('stage tagging does not add a model call', () => {
  const stage = readFileSync(new URL('./buyingStage.js', import.meta.url), 'utf8');
  const check = readFileSync(new URL('./runCheck.js', import.meta.url), 'utf8');
  assert.equal(stage.includes('askWithSearch'), false);
  assert.equal(stage.includes('openai'), false);
  assert.match(check, /stage: coerceStage\(/);
  assert.equal(buildStagedPrompts('CRM', 'HubSpot').length, 3);
});
