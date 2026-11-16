// JSON-LD structured data on a fetched page: parse every block, walk the
// entities the way search engines do, and answer "does this page mark itself
// up as a local business / an FAQ page?". Pure functions, no network.

import { LOCAL_BUSINESS_TYPES } from './localBusinessTypes.js';

const LD_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

// Some CMSs wrap the JSON in an HTML comment or a CDATA section.
function unwrap(raw) {
  return raw
    .trim()
    .replace(/^<!--/, '')
    .replace(/-->$/, '')
    .replace(/^(\/\/\s*)?<!\[CDATA\[/, '')
    .replace(/(\/\/\s*)?\]\]>$/, '')
    .trim();
}

// Every JSON-LD block on the page that parses. Malformed blocks are skipped.
export function jsonLdBlocks(html) {
  const blocks = [];
  for (const match of String(html ?? '').matchAll(LD_SCRIPT)) {
    const raw = unwrap(match[1]);
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // A broken block says nothing about the page's other blocks.
    }
  }
  return blocks;
}

// The page's top-level entities: each block, each item of a top-level array,
// and each item of an @graph (Yoast, Rank Math and most WordPress SEO plugins
// put everything there), including @graph nested in those. Properties of an
// entity (an Event's location, a Review's itemReviewed) are not entities of
// the page, so they are not walked.
export function jsonLdEntities(html) {
  const entities = [];
  const visit = (value, depth) => {
    if (depth > 8 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    entities.push(value);
    if ('@graph' in value) visit(value['@graph'], depth + 1);
  };
  for (const block of jsonLdBlocks(html)) visit(block, 0);
  return entities;
}

// "Dentist", "schema:Dentist", "https://schema.org/Dentist" and
// "http://schema.org/Dentist" all name the same type. Type names are
// case-sensitive in schema.org, so case is kept.
function normalizeType(type) {
  return type
    .trim()
    .replace(/^https?:\/\/(www\.)?schema\.org\//i, '')
    .replace(/^schema:/i, '');
}

export function entityTypes(entity) {
  const raw = entity['@type'] ?? entity.type;
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return list.filter((t) => typeof t === 'string').map(normalizeType);
}

function anyEntityTyped(html, matches) {
  return jsonLdEntities(html).some((entity) => entityTypes(entity).some(matches));
}

// LocalBusiness or any schema.org subtype of it (ProfessionalService, Dentist,
// Plumber, Restaurant, AccountingService... see localBusinessTypes.js).
export function hasLocalBusinessSchema(html) {
  return anyEntityTyped(html, (type) => LOCAL_BUSINESS_TYPES.has(type));
}

export function hasFaqPageSchema(html) {
  return anyEntityTyped(html, (type) => type === 'FAQPage');
}
