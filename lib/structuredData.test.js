import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasLocalBusinessSchema, hasFaqPageSchema, jsonLdEntities, entityTypes } from './structuredData.js';
import { LOCAL_BUSINESS_TYPE_NAMES, LOCAL_BUSINESS_TYPES } from './localBusinessTypes.js';

const ld = (obj) => `<script type="application/ld+json">${typeof obj === 'string' ? obj : JSON.stringify(obj)}</script>`;
const page = (...blocks) => `<html><head><title>T</title>${blocks.join('')}</head><body><h1>Hi</h1></body></html>`;

// --- LocalBusiness -----------------------------------------------------------

test('literal LocalBusiness type passes', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'A' }))), true);
});

test('a LocalBusiness subtype passes (ProfessionalService, Dentist, Plumber, AccountingService)', () => {
  for (const type of ['ProfessionalService', 'Dentist', 'Plumber', 'AccountingService', 'HVACBusiness', 'Restaurant', 'InsuranceAgency']) {
    assert.equal(hasLocalBusinessSchema(page(ld({ '@type': type, name: 'A' }))), true, type);
  }
});

test('medical specialty subtypes pass (Dermatology, Pediatric)', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'Dermatology' }))), true);
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'Pediatric' }))), true);
});

test('array @type with a subtype passes', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': ['Organization', 'Plumber'] }))), true);
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': ['LocalBusiness', 'ProfessionalService'] }))), true);
});

test('@graph (Yoast / Rank Math style) passes', () => {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': 'https://x.test/#website' },
      { '@type': 'WebPage', '@id': 'https://x.test/' },
      { '@type': 'Dentist', '@id': 'https://x.test/#org', name: 'Smile Co' },
    ],
  };
  assert.equal(hasLocalBusinessSchema(page(ld(graph))), true);
});

test('nested @graph passes', () => {
  const nested = { '@graph': [{ '@type': 'WebSite' }, { '@graph': [{ '@type': 'AutoRepair' }] }] };
  assert.equal(hasLocalBusinessSchema(page(ld(nested))), true);
});

test('top-level JSON-LD array passes', () => {
  assert.equal(hasLocalBusinessSchema(page(ld([{ '@type': 'WebSite' }, { '@type': 'Electrician' }]))), true);
});

test('full-URL and prefixed types pass', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'https://schema.org/HVACBusiness' }))), true);
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'http://schema.org/Restaurant' }))), true);
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'schema:Attorney' }))), true);
});

test('a later block is found when an earlier one is a plain Organization', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'Organization' }), ld({ '@type': 'Plumber' }))), true);
});

test('malformed JSON is false and does not throw', () => {
  assert.equal(hasLocalBusinessSchema(page(ld('{"@type": "LocalBusiness",'))), false);
});

test('a malformed block does not hide a valid one', () => {
  assert.equal(hasLocalBusinessSchema(page(ld('{ not json'), ld({ '@type': 'Dentist' }))), true);
});

test('no structured data, or only non-local types, is false', () => {
  assert.equal(hasLocalBusinessSchema(page()), false);
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'Organization' }), ld({ '@type': 'WebSite' }))), false);
  assert.equal(hasLocalBusinessSchema(''), false);
  assert.equal(hasLocalBusinessSchema(undefined), false);
});

test('type names are case-sensitive, as in schema.org', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ '@type': 'localbusiness' }))), false);
});

test('a LocalBusiness nested as a property of another entity is not counted', () => {
  // An event's venue or a review's subject is not the page's own business.
  const event = { '@type': 'Event', location: { '@type': 'LocalBusiness', name: 'Venue' } };
  assert.equal(hasLocalBusinessSchema(page(ld(event))), false);
});

test('comment- and CDATA-wrapped blocks are read', () => {
  assert.equal(hasLocalBusinessSchema(page(ld(`<!--${JSON.stringify({ '@type': 'Plumber' })}-->`))), true);
  assert.equal(hasLocalBusinessSchema(page(ld(`//<![CDATA[\n${JSON.stringify({ '@type': 'Plumber' })}\n//]]>`))), true);
});

test('script attributes in any order, unquoted type, extra attributes', () => {
  const json = JSON.stringify({ '@type': 'Dentist' });
  assert.equal(hasLocalBusinessSchema(`<script nonce="abc" type=application/ld+json data-x="1">${json}</script>`), true);
  assert.equal(hasLocalBusinessSchema(`<SCRIPT TYPE="application/ld+json">${json}</SCRIPT >`), true);
});

test('the legacy "type" key (no @) is still read', () => {
  assert.equal(hasLocalBusinessSchema(page(ld({ type: 'LocalBusiness' }))), true);
});

// --- FAQPage -----------------------------------------------------------------

test('FAQPage at the top level, in @graph, as an array type and as a URL', () => {
  assert.equal(hasFaqPageSchema(page(ld({ '@type': 'FAQPage', mainEntity: [] }))), true);
  assert.equal(hasFaqPageSchema(page(ld({ '@graph': [{ '@type': 'WebSite' }, { '@type': 'FAQPage' }] }))), true);
  assert.equal(hasFaqPageSchema(page(ld({ '@type': ['WebPage', 'FAQPage'] }))), true);
  assert.equal(hasFaqPageSchema(page(ld({ '@type': 'https://schema.org/FAQPage' }))), true);
});

test('no FAQPage is false', () => {
  assert.equal(hasFaqPageSchema(page(ld({ '@type': 'WebPage' }))), false);
  assert.equal(hasFaqPageSchema(page()), false);
});

// --- helpers and the generated list -------------------------------------------

test('jsonLdEntities flattens arrays and @graph but not properties', () => {
  const html = page(ld([{ '@type': 'A' }, { '@graph': [{ '@type': 'B' }] }]), ld({ '@type': 'C', about: { '@type': 'D' } }));
  assert.deepEqual(jsonLdEntities(html).flatMap(entityTypes), ['A', 'B', 'C']);
});

test('generated type list is sane', () => {
  assert.ok(LOCAL_BUSINESS_TYPE_NAMES.length >= 150, `only ${LOCAL_BUSINESS_TYPE_NAMES.length} types`);
  for (const t of ['LocalBusiness', 'ProfessionalService', 'Dentist', 'Plumber', 'MedicalClinic', 'Store', 'LegalService']) {
    assert.ok(LOCAL_BUSINESS_TYPES.has(t), t);
  }
  for (const t of ['Organization', 'Place', 'WebSite', 'Corporation', 'MedicalOrganization']) {
    assert.equal(LOCAL_BUSINESS_TYPES.has(t), false, t);
  }
  assert.ok(LOCAL_BUSINESS_TYPE_NAMES.every((t) => /^[A-Za-z0-9]+$/.test(t)), 'every name is a bare type name');
});
