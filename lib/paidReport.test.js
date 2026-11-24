import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument } from 'pdf-lib';
import { resetStoreForTests, setJSON, readJSON } from './store.js';
import { setMailerForTests, resetMailerForTests } from './mailer.js';
import { setStripeForTests, resetStripeForTests } from './stripeApi.js';
import { applyPaidReportEvent } from './trackingEvents.js';
import { PAID_REPORT_PRICE } from './paidReport.js';
import { buildPaidReportPdf } from './paidReportPdf.js';
import {
  ensureReportDownload, isReportToken, loadPaidReport, newReportToken, reportPageUrl, saveReportAccess,
} from './paidReportAccess.js';
import { paidReportPageModel } from './paidReportPage.js';
import PaidReportView from '../app/PaidReportView.js';
import { GET as pdf } from '../app/api/paid-report/pdf/route.js';

const idA = 'a'.repeat(24);
const idB = 'b'.repeat(24);

function resultFor(brand, answer) {
  return {
    result: {
      brand,
      category: 'crm',
      domain: `${brand.toLowerCase()}.example`,
      mentionedIn: 1,
      total: 1,
      score: 80,
      runs: 1,
      checkedAt: '2026-11-24T15:00:00.000Z',
      rows: [{ prompt: `What is ${brand}?`, mentioned: true, rank: 1, brands: [brand, 'Asana'] }],
      topSources: [{ domain: 'g2.com', n: 1 }],
    },
    answers: [{ prompt: `What is ${brand}?`, text: answer }],
  };
}

async function seed({ token, sessionId, resultId, brand, answer }) {
  const body = resultFor(brand, answer);
  await setJSON(`paid-report-snapshot/${sessionId}`, {
    resultId,
    result: body.result,
    answers: body.answers,
    origin: 'https://aivisibilitychecker.app',
    pdfToken: token,
  });
  await saveReportAccess({ token, sessionId, resultId });
  return body;
}

test('the paid report price is unchanged', () => {
  assert.equal(PAID_REPORT_PRICE, '$19');
  const stripe = readFileSync(new URL('./stripeApi.js', import.meta.url), 'utf8');
  assert.match(stripe, /mode: 'payment'/);
  assert.match(stripe, /line_items: \[\{ price, quantity: 1 \}\]/);
});

test('download links stay on this app', () => {
  const token = newReportToken();
  assert.equal(isReportToken(token), true);
  assert.equal(isReportToken('short'), false);
  const url = new URL(reportPageUrl('https://evil.example/phish', token));
  assert.equal(url.origin, 'https://aivisibilitychecker.app');
  assert.equal(url.pathname, '/paid-report');
  assert.equal(url.searchParams.get('token'), token);
  const preview = new URL(reportPageUrl('https://ai-visibility-checker-git-preview.vercel.app', token));
  assert.equal(preview.host, 'ai-visibility-checker-git-preview.vercel.app');
});

test('a token reads only its own snapshot', async () => {
  resetStoreForTests();
  const tokenA = newReportToken();
  const tokenB = newReportToken();
  await seed({ token: tokenA, sessionId: 'cs_test_report_a', resultId: idA, brand: 'Northstar', answer: 'SECRET-NORTHSTAR' });
  await seed({ token: tokenB, sessionId: 'cs_test_report_b', resultId: idB, brand: 'OtherCo', answer: 'SECRET-OTHERCO' });

  const own = await loadPaidReport(tokenA);
  assert.equal(own.result.brand, 'Northstar');
  assert.equal(own.answers[0].text, 'SECRET-NORTHSTAR');
  assert.equal(await loadPaidReport(tokenB).then((row) => row.result.brand), 'OtherCo');
  assert.equal(await loadPaidReport('nope'), null);
  assert.equal(await loadPaidReport(''), null);

  await setJSON(`paid-report-pdf/${'c'.repeat(24)}`, { sessionId: 'cs_test_report_b', resultId: idB });
  const swapped = await loadPaidReport(tokenA);
  assert.equal(swapped.result.brand, 'Northstar');

  await saveReportAccess({ token: tokenA, sessionId: 'cs_test_report_b', resultId: idB });
  assert.equal(await loadPaidReport(tokenA), null);
  const snap = await readJSON('paid-report-snapshot/cs_test_report_b');
  assert.equal(snap.value.result.brand, 'OtherCo');
  assert.equal(snap.value.answers[0].text, 'SECRET-OTHERCO');
  resetStoreForTests();
});

test('ensuring a download token is stable and refuses a mismatched result', async () => {
  resetStoreForTests();
  const sessionId = 'cs_test_ensure_1';
  await setJSON(`paid-report-snapshot/${sessionId}`, {
    resultId: idA,
    result: resultFor('Northstar', 'only-northstar').result,
    answers: [{ text: 'only-northstar' }],
  });
  const first = await ensureReportDownload({ sessionId, resultId: idA });
  const second = await ensureReportDownload({ sessionId, resultId: idA });
  assert.equal(isReportToken(first), true);
  assert.equal(second, first);
  const loaded = await loadPaidReport(first);
  assert.equal(loaded.answers[0].text, 'only-northstar');

  const denied = await ensureReportDownload({
    sessionId,
    resultId: idB,
    fallback: { result: resultFor('OtherCo', 'nope').result },
  });
  assert.equal(denied, '');
  const still = await readJSON(`paid-report-snapshot/${sessionId}`);
  assert.equal(still.value.result.brand, 'Northstar');
  assert.equal(still.value.pdfToken, first);
  resetStoreForTests();
});

test('pdf route rejects missing tokens, other reports, bad agency names, and url fetches', async () => {
  resetStoreForTests();
  const tokenA = newReportToken();
  const tokenB = newReportToken();
  await seed({ token: tokenA, sessionId: 'cs_test_pdf_a', resultId: idA, brand: 'Northstar', answer: 'SECRET-NORTHSTAR' });
  await seed({ token: tokenB, sessionId: 'cs_test_pdf_b', resultId: idB, brand: 'OtherCo', answer: 'SECRET-OTHERCO' });

  const missing = await pdf(new Request('https://aivisibilitychecker.app/api/paid-report/pdf'));
  assert.equal(missing.status, 404);
  const idOnly = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?id=${idB}`));
  assert.equal(idOnly.status, 404);
  const bad = await pdf(new Request('https://aivisibilitychecker.app/api/paid-report/pdf?token=not-a-token'));
  assert.equal(bad.status, 404);

  const calls = [];
  const originalFetch = globalThis.fetch;
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    throw new Error('fetch blocked');
  };
  try {
    const crossed = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${encodeURIComponent(tokenA)}&id=${idB}&url=${encodeURIComponent('http://169.254.169.254/latest')}`));
    assert.equal(crossed.status, 200);
    assert.equal(crossed.headers.get('content-type'), 'application/pdf');
    assert.equal(crossed.headers.get('cache-control'), 'no-store');
    assert.match(crossed.headers.get('content-disposition'), /ai-visibility-report\.pdf/);
    const bytes = new Uint8Array(await crossed.arrayBuffer());
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
    const opened = await PDFDocument.load(bytes);
    assert.equal(opened.getTitle(), 'AI visibility report for Northstar');
    assert.match(opened.getSubject(), /Learn: 1 prompt, 1 of 1 mention the brand/);
    assert.equal(opened.getTitle().includes('OtherCo'), false);
    assert.equal(Buffer.from(bytes).toString('latin1').includes('SECRET-OTHERCO'), false);
    assert.equal(Buffer.from(bytes).toString('latin1').includes('169.254.169.254'), false);
    assert.equal(calls.length, 0);

    const named = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${tokenA}&agency=${encodeURIComponent('Northstar & Co.')}`));
    assert.equal(named.status, 200);
    const namedPdf = await PDFDocument.load(new Uint8Array(await named.arrayBuffer()));
    assert.equal(namedPdf.getAuthor(), 'Prepared by Northstar & Co.');

    const cafe = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${tokenA}&agency=${encodeURIComponent('Café Agency')}`));
    assert.equal(cafe.status, 200);
    const cafePdf = await PDFDocument.load(new Uint8Array(await cafe.arrayBuffer()));
    assert.equal(cafePdf.getAuthor(), 'Prepared by Café Agency');

    const blank = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${tokenA}&agency=`));
    const blankPdf = await PDFDocument.load(new Uint8Array(await blank.arrayBuffer()));
    assert.equal(blankPdf.getAuthor(), 'Prepared by AI Visibility Checker');

    const tooLong = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${tokenA}&agency=${encodeURIComponent('A'.repeat(81))}`));
    assert.equal(tooLong.status, 303);
    const back = new URL(tooLong.headers.get('location'));
    assert.equal(back.origin, 'https://aivisibilitychecker.app');
    assert.equal(back.pathname, '/paid-report');
    assert.equal(back.searchParams.get('token'), tokenA);
    assert.equal(back.searchParams.get('error'), 'agency');
    assert.equal(back.searchParams.get('agency'), null);
    assert.equal(back.searchParams.get('url'), null);

    const injected = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${tokenA}&agency=${encodeURIComponent('Acme\nBcc: evil@example.com')}`));
    assert.equal(injected.status, 303);
    assert.equal(new URL(injected.headers.get('location')).searchParams.get('agency'), null);

    const markup = await pdf(new Request(`https://aivisibilitychecker.app/api/paid-report/pdf?token=${tokenA}&agency=${encodeURIComponent('<script>')}`));
    assert.equal(markup.status, 303);

    const foreign = await pdf(new Request(`https://evil.example/api/paid-report/pdf?token=${tokenA}&agency=${encodeURIComponent('A'.repeat(81))}`));
    assert.equal(foreign.status, 400);
    assert.equal(foreign.headers.get('location'), null);
    assert.equal(await foreign.text(), 'Agency name must be 80 characters or fewer, using letters, numbers, and simple punctuation.');
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
  assert.equal(logs.some((line) => line.includes(tokenA) || line.includes('SECRET-NORTHSTAR')), false);
  assert.equal(calls.length, 0);
  resetStoreForTests();
});

test('an old saved report renders on the paid report page', async () => {
  resetStoreForTests();
  const token = newReportToken();
  await seed({
    token,
    sessionId: 'cs_test_page_old',
    resultId: idA,
    brand: 'Northstar',
    answer: 'Northstar is a project tool. <script>',
  });
  const model = await paidReportPageModel({ token });
  assert.ok(model);
  const html = renderToStaticMarkup(createElement(PaidReportView, model));
  assert.equal(html.includes('<h2>Learn</h2>'), true);
  assert.equal(html.includes('<h2>Compare</h2>'), true);
  assert.equal(html.includes('<h2>Buy</h2>'), true);
  assert.equal(html.includes('What is Northstar?'), true);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('No prompts in this stage.'), true);
  const visible = html.replace(/<input[^>]*>/g, '');
  assert.equal(visible.includes(token), false);
  assert.equal(await paidReportPageModel({ token: 'not-a-token' }), null);
  assert.equal(await paidReportPageModel({ token: idA }), null);
  const page = readFileSync(new URL('../app/paid-report/page.js', import.meta.url), 'utf8');
  assert.match(page, /if \(!model\) notFound\(\)/);
  assert.match(page, /paidReportPageModel/);
  resetStoreForTests();
});

test('webhook email groups an old snapshot and links only that download', async () => {
  resetStoreForTests();
  let sent = null;
  setMailerForTests(async (message) => {
    sent = message;
    return { ok: true };
  });
  await setJSON('paid-report-snapshot/cs_test_mail_old', {
    resultId: idA,
    result: {
      brand: 'Northstar',
      category: 'project management',
      mentionedIn: 1,
      total: 3,
      score: 40,
      runs: 1,
      checkedAt: '2026-11-24T15:00:00.000Z',
      rows: [
        { prompt: 'What is project management software?', mentioned: false, brands: [] },
        { prompt: 'best project management tools', mentioned: true, rank: 2, brands: ['Asana', 'Northstar'] },
        { prompt: 'Northstar pricing', mentioned: true, rank: 1, brands: ['Northstar'] },
      ],
      topSources: [],
    },
    answers: [
      { prompt: 'What is project management software?', text: 'A way to plan work.' },
      { prompt: 'best project management tools', text: 'Asana is listed. <script>' },
      { prompt: 'Northstar pricing', text: 'It costs money.' },
    ],
  });
  const result = await applyPaidReportEvent({
    type: 'checkout.session.completed',
    id: 'evt_paid_report_stages',
    data: {
      object: {
        id: 'cs_test_mail_old',
        mode: 'payment',
        payment_status: 'paid',
        payment_intent: 'pi_paid_report_stages',
        metadata: { type: 'paid_report', email: 'buyer@example.com', resultId: idA, brand: 'Northstar' },
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.match(sent.subject, /Northstar/);
  assert.equal(sent.html.includes('<h2>Learn</h2>'), true);
  assert.equal(sent.html.includes('<h2>Compare</h2>'), true);
  assert.equal(sent.html.includes('<h2>Buy</h2>'), true);
  assert.equal(sent.html.includes('<script>'), false);
  assert.equal(sent.html.includes('Kovyr'), false);
  assert.match(sent.text, /Learn: 1 prompt, 0 of 1 mention the brand/);
  assert.match(sent.text, /Compare: 1 prompt, 1 of 1 mention the brand/);
  assert.match(sent.text, /Asana \(1\)/);
  assert.match(sent.text, /Buy: 1 prompt, 1 of 1 mention the brand/);
  const link = sent.text.match(/https:\/\/aivisibilitychecker\.app\/paid-report\?token=([A-Za-z0-9_-]{43})/);
  assert.ok(link);
  const loaded = await loadPaidReport(link[1]);
  assert.equal(loaded.result.brand, 'Northstar');
  assert.equal(loaded.answers[1].text.includes('<script>'), true);
  resetMailerForTests();
  resetStoreForTests();
});

test('checkout still starts Stripe payment mode and stores a download token', async () => {
  resetStoreForTests();
  process.env.PAID_REPORT_ENABLED = '1';
  process.env.STRIPE_PAID_REPORT_PRICE_ID = 'price_test123';
  let params = null;
  setStripeForTests({
    checkout: {
      sessions: {
        create: async (input) => {
          params = input;
          return { id: 'cs_test_checkout_pdf', url: 'https://checkout.stripe.com/pay/cs_test_checkout_pdf' };
        },
      },
    },
  });
  await setJSON(`cache/${idA}`, {
    at: Date.now(),
    result: resultFor('Northstar', 'stored-answer').result,
  });
  const { POST } = await import('../app/api/checkout-report/route.js');
  const res = await POST(new Request('https://aivisibilitychecker.app/api/checkout-report', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://aivisibilitychecker.app',
      host: 'aivisibilitychecker.app',
    },
    body: JSON.stringify({ email: 'buyer@example.com', brand: 'Northstar', resultId: idA }),
  }));
  assert.equal(res.status, 200);
  assert.equal(params.mode, 'payment');
  assert.deepEqual(params.line_items, [{ price: 'price_test123', quantity: 1 }]);
  assert.equal(params.metadata.type, 'paid_report');
  const snapshot = await readJSON('paid-report-snapshot/cs_test_checkout_pdf');
  assert.equal(snapshot.value.resultId, idA);
  assert.equal(isReportToken(snapshot.value.pdfToken), true);
  const loaded = await loadPaidReport(snapshot.value.pdfToken);
  assert.equal(loaded.result.brand, 'Northstar');
  delete process.env.PAID_REPORT_ENABLED;
  delete process.env.STRIPE_PAID_REPORT_PRICE_ID;
  resetStripeForTests();
  resetStoreForTests();
});

test('pdf generation survives characters the standard font cannot encode', async () => {
  const bytes = await buildPaidReportPdf({
    result: {
      brand: '東京',
      category: 'tea',
      mentionedIn: 0,
      total: 1,
      score: 0,
      checkedAt: '2026-11-24T00:00:00.000Z',
      rows: [{ prompt: 'What is 東京?', mentioned: false, brands: [] }],
    },
    answers: [{ text: 'A city. 😀' }],
    agency: '',
  });
  const opened = await PDFDocument.load(bytes);
  assert.match(opened.getTitle(), /AI visibility report/);
  assert.equal(opened.getPageCount() >= 1, true);
});
