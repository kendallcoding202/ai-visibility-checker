import { readAnswerCookie, loadRawAnswers } from '../../../lib/rawAnswers.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[a-f0-9]{24}$/.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const cookie = readAnswerCookie(req.headers.get('cookie'));
  if (!cookie || cookie.shareId !== id) return Response.json({ error: 'Not found' }, { status: 404 });
  const raw = await loadRawAnswers(cookie.token);
  if (!raw || raw.shareId !== id) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(
    { runs: raw.runs, answers: raw.answers },
    { headers: { 'cache-control': 'no-store' } },
  );
}
