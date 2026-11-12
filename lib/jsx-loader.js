import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'next/dist/build/swc/index.js';

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.includes('/ai-visibility-checker/app/') || !url.endsWith('.js')) {
    return nextLoad(url, context);
  }
  const path = fileURLToPath(url);
  const source = readFileSync(path, 'utf8');
  if (!source.includes('<')) return nextLoad(url, context);
  const out = transformSync(source, {
    filename: path,
    sourceMaps: false,
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      transform: { react: { runtime: 'automatic' } },
    },
    module: { type: 'es6' },
  });
  return { format: 'module', source: out.code, shortCircuit: true };
}
