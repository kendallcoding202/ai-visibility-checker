// Weekly re-checks for active paid subscribers.
// Spend is recorded on tracking-spend/<month>, never on the free-checker month key.
import { timingSafeEqual } from 'node:crypto';
import { hashKey } from './hash.js';
import { originForMail } from './emailAddress.js';
import { trackingEmail } from './emailCopy.js';
import { sendMail } from './mailer.js';
import { reportSnapshot } from './publicResult.js';
import { readJSON, setJSON } from './store.js';
import { money } from './limits.js';
import { getSubscriber, saveSubscriber } from './subscribers.js';
import { openSeal } from './seal.js';
import { getPrivateJSON } from './privateStore.js';
import { runVisibilityCheck } from './runCheck.js';
import {
  TRACKING_RESERVE_USD,
  trackingMonthlyBudgetUsd,
  trackingSpendAllowed,
  trackingSpendKey,
  weeklyRunAllowed,
} from './trackingMoney.js';
import { forgetTrackingId, listTrackingIds } from './trackingRecords.js';

const MAX_PER_CRON = 100;
const noStore = { 'cache-control': 'no-store' };

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET ?? '').trim();
  if (secret.length < 16) return false;
  const header = req.headers.get('authorization') ?? '';
  return safeEqual(header, `Bearer ${secret}`);
}

async function readSpend(month) {
  const read = await readJSON(trackingSpendKey(month));
  if (!read.ok) return { ok: false, cost: 0 };
  const cost = Number(read.value?.cost ?? 0);
  if (!Number.isFinite(cost)) return { ok: false, cost: 0 };
  return { ok: true, cost, n: read.value?.n ?? 0 };
}

async function writeSpend(month, cost, n) {
  await setJSON(trackingSpendKey(month), { cost: money(Math.max(0, cost)), n: Math.max(0, n) });
}

function mailUrls(record, origin) {
  const manage = `${origin}/tracking/manage?token=${encodeURIComponent(record.manageToken)}`;
  return {
    manageUrl: manage,
    portalUrl: `${origin}/api/tracking/portal?token=${encodeURIComponent(record.manageToken)}`,
    unsubPage: `${origin}/email/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`,
    unsubApi: `${origin}/api/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`,
  };
}

async function sendTrackingResult(record, origin) {
  const urls = mailUrls(record, origin);
  const message = trackingEmail({
    snapshot: record.snapshot,
    answers: record.answers,
    runNumber: record.trackingRunCount,
    unsubUrl: urls.unsubPage,
    manageUrl: urls.manageUrl,
    portalUrl: urls.portalUrl,
  });
  const sent = await sendMail({
    to: record.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    unsubUrl: urls.unsubApi,
    idempotencyKey: `tracking/${hashKey(record.email)}/${record.trackingRunCount}/${Date.now()}`,
  });
  return sent.ok;
}

export async function runTrackingCron(req, { run = runVisibilityCheck, now = () => Date.now() } = {}) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }
  const origin = originForMail(req.headers.get('host')) || originForMail('aivisibilitychecker.app');
  if (!origin) return Response.json({ error: 'Tracking is temporarily unavailable.' }, { status: 503, headers: noStore });
  if ((process.env.OPENAI_API_KEY ?? '').length < 20 && run === runVisibilityCheck) {
    return Response.json({ error: 'Tracking is temporarily unavailable.' }, { status: 503, headers: noStore });
  }

  const month = new Date(now()).toISOString().slice(0, 7);
  const spend = await readSpend(month);
  if (!spend.ok) return Response.json({ error: 'Tracking is temporarily unavailable.' }, { status: 503, headers: noStore });

  const ids = (await listTrackingIds()).slice(0, MAX_PER_CRON);
  let ran = 0;
  let skipped = 0;
  let stopped = '';
  let spent = spend.cost;
  let count = spend.n;

  for (const id of ids) {
    if (stopped) break;
    const record = await getSubscriberById(id);
    if (!record?.trackingActive || !record.manageToken || !record.unsubToken) {
      await forgetTrackingId(id);
      skipped += 1;
      continue;
    }
    if (record.trackingEmailPending) {
      const sent = await sendTrackingResult(record, origin);
      if (sent) {
        record.trackingEmailPending = false;
        await saveSubscriber(record);
      }
      skipped += 1;
      continue;
    }
    if (!weeklyRunAllowed(record.trackingLastRunAt, now())) {
      skipped += 1;
      continue;
    }
    const budget = trackingMonthlyBudgetUsd();
    if (!trackingSpendAllowed(spent, TRACKING_RESERVE_USD, budget)) {
      stopped = 'budget';
      break;
    }
    spent = money(spent + TRACKING_RESERVE_USD);
    count += 1;
    await writeSpend(month, spent, count);

    const brand = String(record.trackingBrand || record.snapshot?.brand || '').trim();
    if (!brand) {
      spent = money(spent - TRACKING_RESERVE_USD);
      count -= 1;
      await writeSpend(month, spent, count);
      skipped += 1;
      continue;
    }

    try {
      const deadline = now() + 80_000;
      const checked = await run({
        brand,
        category: record.trackingCategory || record.snapshot?.category || '',
        competitors: [],
        deadline,
        searchTimeoutMs: 40_000,
        refundReserveMs: 8_000,
      });
      const measured = money(checked?.cost ?? 0);
      spent = money(spent - TRACKING_RESERVE_USD + (Number.isFinite(measured) ? measured : TRACKING_RESERVE_USD));
      await writeSpend(month, spent, count);
      record.snapshot = reportSnapshot(checked.result);
      record.answers = (checked.rawAnswers ?? []).slice(0, 6).map((a) => ({
        prompt: String(a.prompt ?? '').slice(0, 300),
        text: String(a.text ?? '').slice(0, 12000),
      }));
      record.trackingRunCount = (record.trackingRunCount ?? 0) + 1;
      record.trackingLastRunAt = new Date(now()).toISOString();
      record.trackingEmailPending = true;
      await saveSubscriber(record);
      const sent = await sendTrackingResult(record, origin);
      if (sent) {
        record.trackingEmailPending = false;
        await saveSubscriber(record);
      }
      ran += 1;
    } catch (error) {
      spent = money(spent - TRACKING_RESERVE_USD);
      count -= 1;
      await writeSpend(month, spent, count);
      console.error(`tracking run failed name=${error?.name || 'Error'}`);
      skipped += 1;
    }
  }

  console.log(`tracking cron ran=${ran} skipped=${skipped} stopped=${stopped || 'none'}`);
  return Response.json({ ok: true, ran, skipped, stopped }, { headers: noStore });
}

async function getSubscriberById(id) {
  const record = openSeal(await getPrivateJSON(`mail/addr/${id}`));
  if (!record?.email || record.deleted) return null;
  return getSubscriber(record.email);
}
