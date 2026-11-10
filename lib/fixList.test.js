import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packCitations, buildFixList, pageKind, shortUrl, safeHref } from './fixList.js';

const longPath = `/articles/${'a'.repeat(200)}`;
const longUrl = `https://www.example.com${longPath}?utm=1`;

test('packCitations keeps http(s), drops the rest, dedupes, and caps', () => {
  const packed = packCitations([
    { url: 'https://g2.com/products/acme/reviews', title: ' Acme  reviews \n' },
    { url: 'https://g2.com/products/acme/reviews#cited' },
    { url: 'javascript:alert(1)', title: 'nope' },
    { url: 'notaurl' },
    { url: 'http://directory.example/listings/acme', title: '' },
    ...Array.from({ length: 10 }, (_, i) => ({ url: `https://cdn.example/p/${i}`, title: `Page ${i}` })),
  ]);
  assert.equal(packed.length, 8);
  assert.equal(packed[0].url, 'https://g2.com/products/acme/reviews');
  assert.equal(packed[0].title, 'Acme reviews');
  assert.equal(packed.filter((p) => p.url.includes('g2.com')).length, 1);
  assert.equal(packed.some((p) => p.url.startsWith('javascript:')), false);
  assert.equal(packed[1].url, 'http://directory.example/listings/acme');
  assert.equal('title' in packed[1], false);
});

test('buildFixList dedupes pages and ranks domains by citations on missing questions only', () => {
  const list = buildFixList({
    rows: [
      {
        prompt: 'Best CRM?',
        mentioned: false,
        citations: [
          { url: 'https://www.g2.com/products/acme/reviews', title: 'Acme reviews' },
          { url: 'https://g2.com/products/acme/reviews', title: 'Acme reviews' },
          { url: 'https://www.g2.com/categories/crm', title: 'CRM category' },
          { url: 'https://blog.example/best-crm-tools', title: 'Best CRM tools' },
        ],
      },
      {
        prompt: 'CRM for a small team?',
        mentioned: true,
        citations: [{ url: 'https://ignored.example/only-when-named', title: 'Should not count' }],
      },
      {
        prompt: 'Which CRM do experts rate?',
        mentioned: false,
        citations: [
          { url: 'https://blog.example/best-crm-tools', title: 'Best CRM tools' },
          { url: 'https://news.example/notes', title: 'A news note' },
        ],
      },
    ],
  });
  assert.equal(list.questions.length, 2);
  assert.equal(list.questions[0].pages.length, 3);
  assert.deepEqual(list.sites.map((s) => [s.domain, s.n]), [
    ['blog.example', 2],
    ['g2.com', 2],
    ['news.example', 1],
  ]);
  assert.equal(list.sites.some((s) => s.domain === 'ignored.example'), false);
  assert.equal(list.sites.find((s) => s.domain === 'g2.com').kind, 'review');
  assert.equal(list.sites.find((s) => s.domain === 'blog.example').kind, 'listicle');
  assert.equal(list.sites.find((s) => s.domain === 'news.example').kind, null);
  assert.deepEqual(list.sites.find((s) => s.domain === 'news.example').actions, [
    'Earn a mention on this site.',
    'Publish a page that answers the same question with clear facts.',
  ]);
  assert.equal(list.sites.find((s) => s.domain === 'blog.example').actions.length, 2);
});

test('equal citation counts sort by domain name, and only the top sites are kept', () => {
  const rows = [{
    prompt: 'Q',
    mentioned: false,
    citations: 'abcdefg'.split('').map((ch) => ({ url: `https://${ch}.example/page`, title: 'Page' })),
  }];
  const list = buildFixList({ rows });
  assert.deepEqual(list.sites.map((s) => s.domain), [
    'a.example', 'b.example', 'c.example', 'd.example', 'e.example', 'f.example',
  ]);
  assert.equal(list.sites.some((s) => s.domain === 'g.example'), false);
});

test('brand named in every question shows nothing', () => {
  assert.equal(buildFixList({ rows: [{ prompt: 'Q', mentioned: true, citations: [{ url: 'https://a.example', title: 'A' }] }] }), null);
  assert.equal(buildFixList({ rows: [] }), null);
  assert.equal(buildFixList(null), null);
});

test('missing questions with no citations still list the question and no sites', () => {
  const older = buildFixList({ rows: [{ prompt: 'Best CRM?', mentioned: false }] });
  assert.equal(older.questions.length, 1);
  assert.equal(older.questions[0].stored, false);
  assert.deepEqual(older.questions[0].pages, []);
  assert.deepEqual(older.sites, []);
  const empty = buildFixList({ rows: [{ prompt: 'Best CRM?', mentioned: false, citations: [] }] });
  assert.equal(empty.questions[0].stored, true);
  assert.deepEqual(empty.sites, []);
});

test('long URLs are shortened for display and unsafe hrefs are dropped', () => {
  assert.ok(shortUrl(longUrl).length <= 64);
  assert.ok(shortUrl(longUrl).startsWith('example.com/articles/'));
  assert.ok(shortUrl(longUrl).endsWith('…'));
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('https://ok.example/a'), 'https://ok.example/a');
  const list = buildFixList({
    rows: [{ prompt: 'Q', mentioned: false, citations: [{ url: longUrl, title: '' }, { url: 'javascript:alert(1)', title: 'x' }] }],
  });
  assert.equal(list.questions[0].pages.length, 1);
  assert.equal(list.questions[0].pages[0].url.startsWith('https://www.example.com/articles/'), true);
  assert.equal(list.sites[0].domain, 'example.com');
});

test('page kind is a heuristic on the page, not a hardcoded domain', () => {
  assert.equal(pageKind({ url: 'https://g2.com/', title: 'G2' }), null);
  assert.equal(pageKind({ url: 'https://g2.com/products/acme/reviews', title: 'Acme' }), 'review');
  assert.equal(pageKind({ url: 'https://www.g2.com/categories/crm/reviews', title: 'Best CRM Software Reviews' }), 'review');
  assert.equal(pageKind({ url: 'https://clutch.co/directory/crm', title: 'CRM firms' }), 'directory');
  assert.equal(pageKind({ url: 'https://blog.example/best-crm-tools', title: 'Notes' }), 'listicle');
  assert.equal(pageKind({ url: 'https://news.example/story', title: 'What happened' }), null);
});
