import { assertHashSalt, HashSaltError } from '../../../../lib/hash.js';
import { runTrackingCron } from '../../../../lib/trackingCron.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) {
      return Response.json({ error: 'Tracking is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    throw e;
  }
  return runTrackingCron(req);
}
