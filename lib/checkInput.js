// Shared validation for a brand check. Category is optional.
// A website URL is not required and is not fetched.

const FIELD = /^[\p{L}\p{N} .,&'+\-/()!]+$/u;

export function cleanField(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f<>{}\[\]`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function parseCheckInput(body) {
  const brand = cleanField(body?.brand, 60);
  const category = cleanField(body?.category, 80);
  const competitors = String(body?.competitors ?? '').split(',').map((c) => cleanField(c, 60)).filter(Boolean).slice(0, 5);
  if (brand.length < 2) return { error: 'Enter a brand name.' };
  if (category && category.length < 3) return { error: 'Use at least 3 characters for a category, or leave it blank.' };
  const fields = [brand, ...(category ? [category] : []), ...competitors];
  if (!fields.every((s) => FIELD.test(s))) return { error: 'Please use plain letters and numbers only.' };
  return { brand, category, competitors };
}
