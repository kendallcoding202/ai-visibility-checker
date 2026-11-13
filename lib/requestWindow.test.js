import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxDuration as checkMax } from '../app/api/check/route.js';
import { maxDuration as lookupMax } from '../app/api/lookup/route.js';
import { checkSchedule, lookupSchedule } from './requestWindow.js';
import { blobReadWorstMs, blobWriteWorstMs } from './store.js';
import { rawAnswerPutWorstMs } from './rawAnswers.js';
import { CHECK_TIMEOUT_ERROR, LOOKUP_UNAVAILABLE_ERROR, RESULT_UNAVAILABLE_ERROR } from './checkError.js';

const ENV = ['CHECK_BUDGET_MS', 'REFUND_RESERVE_MS', 'LOOKUP_DEADLINE_MS'];

test('check and lookup schedules finish before the platform kill', () => {
  const prev = new Map(ENV.map((key) => [key, process.env[key]]));
  for (const key of ENV) delete process.env[key];
  try {
    const check = checkSchedule(0);
    assert.equal(checkMax, 120);
    assert.equal(check.maxDurationSec, checkMax);
    const callsStop = check.modelDeadline - check.reserveMs;
    const tail = blobWriteWorstMs() + rawAnswerPutWorstMs() + blobReadWorstMs() + blobWriteWorstMs();
    assert.equal(tail <= check.tailMs, true);
    assert.equal(callsStop + check.tailMs <= check.hardStop, true);
    assert.equal(check.hardStop < check.limit, true);
    assert.equal(check.limit, checkMax * 1000);
    assert.equal(callsStop > 30_000, true);

    const lookup = lookupSchedule(0);
    assert.equal(lookupMax, 90);
    assert.equal(lookup.maxDurationSec, lookupMax);
    const lookupStop = lookup.modelDeadline - lookup.reserveMs;
    const lookupTail = blobWriteWorstMs() + blobReadWorstMs() + blobWriteWorstMs();
    assert.equal(lookupTail <= lookup.tailMs, true);
    assert.equal(lookupStop + lookup.tailMs <= lookup.hardStop, true);
    assert.equal(lookup.limit, lookupMax * 1000);
    assert.equal(lookupStop > 20_000, true);
  } finally {
    for (const [key, value] of prev) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('user-facing store and timeout copy stays free of provider details', () => {
  for (const message of [CHECK_TIMEOUT_ERROR, RESULT_UNAVAILABLE_ERROR, LOOKUP_UNAVAILABLE_ERROR]) {
    assert.equal(typeof message, 'string');
    assert.equal(message.length > 20 && message.length < 180, true);
    assert.equal(/blob|token|openai|stack|timeout error/i.test(message), false);
  }
  assert.match(CHECK_TIMEOUT_ERROR, /not used/i);
});
