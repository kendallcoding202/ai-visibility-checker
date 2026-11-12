import {
  adminMetricsAllowed,
  metricsAuthorized,
  readTrackingMetrics,
} from '../../../../lib/trackingMetrics.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const headers = {
  'cache-control': 'no-store, private, max-age=0',
  'cdn-cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(req) {
  if (!adminMetricsAllowed()) {
    return Response.json({ error: 'Too many requests.' }, { status: 429, headers });
  }
  if (!metricsAuthorized(req.headers.get('authorization'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  try {
    const report = await readTrackingMetrics();
    if (!report.ok) return Response.json({ error: 'Unavailable' }, { status: 503, headers });
    return Response.json({ days: report.days }, { headers });
  } catch {
    return Response.json({ error: 'Unavailable' }, { status: 503, headers });
  }
}
