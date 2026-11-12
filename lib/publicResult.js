// The public check payload. Raw answer text is never included.

export function publicResult(result, { id, cached }) {
  const rows = (result?.rows ?? []).map((row) => {
    const { excerpt, text, answer, raw, ...rest } = row ?? {};
    return rest;
  });
  const { answers, excerpt, rawAnswers, ...rest } = result ?? {};
  return {
    ...rest,
    rows,
    runs: Number(result?.runs) > 0 ? Number(result.runs) : 1,
    id,
    cached: Boolean(cached),
  };
}

export function runLine(runs, total) {
  const r = Number(runs) > 0 ? Number(runs) : 1;
  const n = Number(total) >= 0 ? Number(total) : 0;
  const runWord = r === 1 ? 'run' : 'runs';
  const qWord = n === 1 ? 'question' : 'questions';
  return `This score is based on ${r} ${runWord} of ${n} ${qWord}. One run is a single snapshot, so the score can move on the next run.`;
}

export function reportSnapshot(result) {
  return {
    brand: String(result?.brand ?? '').slice(0, 60),
    category: String(result?.category ?? '').slice(0, 80),
    mentionedIn: result?.mentionedIn ?? 0,
    total: result?.total ?? 0,
    score: result?.score ?? 0,
    avgRank: result?.avgRank ?? null,
    runs: Number(result?.runs) > 0 ? Number(result.runs) : 1,
    rows: (result?.rows ?? []).slice(0, 6).map((r) => ({
      prompt: String(r?.prompt ?? '').slice(0, 300),
      mentioned: Boolean(r?.mentioned),
      rank: r?.rank ?? null,
      brands: (r?.brands ?? []).slice(0, 8).map((b) => String(b).slice(0, 60)),
    })),
    topBrands: (result?.topBrands ?? []).slice(0, 8).map((b) => ({ name: String(b?.name ?? '').slice(0, 60), n: b?.n ?? 0 })),
    topSources: (result?.topSources ?? []).slice(0, 6).map((s) => ({ domain: String(s?.domain ?? '').slice(0, 120), n: s?.n ?? 0 })),
    checkedAt: result?.checkedAt ?? null,
  };
}
