import { confirmPost } from '../../subscribe/route.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req) {
  return confirmPost(req);
}
