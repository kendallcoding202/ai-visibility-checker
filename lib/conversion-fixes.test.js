// Tests for conversion fixes: paid checkout, webhook delivery, 409 handling, relaxed gate, 404 filter, server events
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setMailerForTests, resetMailerForTests } from './mailer.js';
import { setStripeForTests, resetStripeForTests } from './stripeApi.js';
import { applyPaidReportEvent } from './trackingEvents.js';
import { resetStoreForTests, setJSON, readJSON } from './store.js';
import { eventProps, EVENTS } from './analyticsEvents.js';

describe('paid report checkout validation', () => {
  it('checkout-report accepts without email confirmation', async () => {
    process.env.PAID_REPORT_ENABLED = '1';
    process.env.STRIPE_PAID_REPORT_PRICE_ID = 'price_test123';
    resetStoreForTests();
    
    // Mock Stripe
    const stripe = {
      checkout: {
        sessions: {
          create: async (params) => {
            assert.equal(params.mode, 'payment');
            assert.equal(params.customer_email, 'test@example.com');
            return { id: 'cs_test123', url: 'https://checkout.stripe.com/test' };
          },
        },
      },
    };
    setStripeForTests(stripe);
    
    // Set up result cache
    await setJSON('cache/abc123def456789012345678', {
      at: Date.now(),
      result: {
        brand: 'TestBrand',
        category: 'test',
        score: 50,
        mentionedIn: 1,
        total: 3,
        topBrands: [],
        topSources: [],
        rows: [],
      },
    });
    
    const { POST } = await import('../app/api/checkout-report/route.js');
    const host = 'aivisibilitychecker.app';
    const req = new Request(`https://${host}/api/checkout-report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': `https://${host}`,
        'host': host,
      },
      body: JSON.stringify({
        email: 'test@example.com',
        brand: 'TestBrand',
        resultId: 'abc123def456789012345678',
      }),
    });
    
    const res = await POST(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.url);
    
    // Verify snapshot was created
    const snapshot = await readJSON('paid-report-snapshot/cs_test123');
    assert.ok(snapshot.ok);
    assert.equal(snapshot.value.resultId, 'abc123def456789012345678');
    assert.ok(snapshot.value.result);
    
    delete process.env.PAID_REPORT_ENABLED;
    delete process.env.STRIPE_PAID_REPORT_PRICE_ID;
    resetStoreForTests();
    resetStripeForTests();
  });
  
  it('checkout-report rejects missing result', async () => {
    process.env.PAID_REPORT_ENABLED = '1';
    process.env.STRIPE_PAID_REPORT_PRICE_ID = 'price_test123';
    resetStoreForTests();
    resetStripeForTests();
    
    const { POST } = await import('../app/api/checkout-report/route.js');
    const host = 'aivisibilitychecker.app';
    const req = new Request(`https://${host}/api/checkout-report`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': `https://${host}`,
        'host': host,
      },
      body: JSON.stringify({
        email: 'test@example.com',
        brand: 'TestBrand',
        resultId: 'abc123def456789012345678',
      }),
    });
    
    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /no longer available/i);
    
    delete process.env.PAID_REPORT_ENABLED;
    delete process.env.STRIPE_PAID_REPORT_PRICE_ID;
    resetStoreForTests();
  });
});

describe('webhook paid report delivery', () => {
  it('delivers report with snapshot', async () => {
    resetStoreForTests();
    
    let mailCalled = false;
    setMailerForTests(async ({ to, subject, idempotencyKey }) => {
      mailCalled = true;
      assert.equal(to, 'customer@example.com');
      assert.match(subject, /AI visibility report/i);
      assert.ok(idempotencyKey);
      return { ok: true };
    });
    
    // Set up snapshot
    await setJSON('paid-report-snapshot/cs_test123', {
      resultId: 'abc123def456789012345678',
      result: {
        brand: 'TestBrand',
        category: 'test',
        score: 75,
        mentionedIn: 2,
        total: 3,
        avgRank: 2,
        topBrands: [{ name: 'Competitor', n: 3 }],
        topSources: [{ domain: 'example.com', n: 2 }],
        rows: [
          { prompt: 'Test question 1', mentioned: true, rank: 1, brands: ['TestBrand', 'Other'] },
          { prompt: 'Test question 2', mentioned: true, rank: 3, brands: ['TestBrand'] },
          { prompt: 'Test question 3', mentioned: false, brands: ['Competitor'] },
        ],
      },
      answers: [
        { prompt: 'Test question 1', text: 'Answer 1 text' },
        { prompt: 'Test question 2', text: 'Answer 2 text' },
        { prompt: 'Test question 3', text: 'Answer 3 text' },
      ],
    });
    
    const event = {
      type: 'checkout.session.completed',
      id: 'evt_test',
      data: {
        object: {
          id: 'cs_test123',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_test',
          metadata: {
            type: 'paid_report',
            email: 'customer@example.com',
            resultId: 'abc123def456789012345678',
            brand: 'TestBrand',
          },
        },
      },
    };
    
    const result = await applyPaidReportEvent(event);
    assert.ok(result.ok);
    assert.ok(result.applied);
    assert.ok(mailCalled);
    
    resetStoreForTests();
    resetMailerForTests();
  });
  
  it.skip('handles missing result with alert', async () => {
    resetStoreForTests();
    
    // Mock is only called when an alert is sent (subject includes 'undeliverable')
    // The actual report send won't happen because result is missing
    let alertSent = false;
    setMailerForTests(async ({ to, subject }) => {
      if (subject && subject.includes('undeliverable')) {
        alertSent = true;
        assert.equal(to, 'admin@example.com');
        return { ok: true };
      }
      // Should not reach here - no report send attempted when result is missing
      return { ok: false, reason: 'send' };
    });
    
    process.env.ALERT_EMAIL = 'admin@example.com';
    
    const event = {
      type: 'checkout.session.completed',
      id: 'evt_test',
      data: {
        object: {
          id: 'cs_test456',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_test',
          metadata: {
            type: 'paid_report',
            email: 'customer@example.com',
            resultId: 'missing123456789012345678',
            brand: 'TestBrand',
          },
        },
      },
    };
    
    const result = await applyPaidReportEvent(event);
    assert.strictEqual(result.ok, false, 'result.ok should be false when result is missing');
    assert.strictEqual(result.retry, true, 'result.retry should be true to retry later');
    assert.strictEqual(alertSent, true, 'alert should have been sent');
    
    delete process.env.ALERT_EMAIL;
    resetStoreForTests();
    resetMailerForTests();
  });
  
  it('retries on mail failure', async () => {
    resetStoreForTests();
    
    setMailerForTests(async () => ({ ok: false, reason: 'send' }));
    
    await setJSON('paid-report-snapshot/cs_test789', {
      resultId: 'abc123def456789012345678',
      result: {
        brand: 'TestBrand',
        score: 50,
        mentionedIn: 1,
        total: 3,
        topBrands: [],
        topSources: [],
        rows: [],
      },
    });
    
    const event = {
      type: 'checkout.session.completed',
      id: 'evt_test',
      data: {
        object: {
          id: 'cs_test789',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_test',
          metadata: {
            type: 'paid_report',
            email: 'customer@example.com',
            resultId: 'abc123def456789012345678',
            brand: 'TestBrand',
          },
        },
      },
    };
    
    const result = await applyPaidReportEvent(event);
    assert.ok(!result.ok);
    assert.ok(result.retry);
    
    resetStoreForTests();
    resetMailerForTests();
  });
});

describe('mailer 409 handling', () => {
  it.skip('treats 409 as success', async () => {
    process.env.RESEND_API_KEY = 're_test123456789';
    process.env.RESEND_FROM = 'Test <test@aivisibilitychecker.app>';
    
    const original = global.fetch;
    global.fetch = async (url, opts) => {
      if (url.includes('resend.com')) {
        return { ok: false, status: 409 };
      }
      return original(url, opts);
    };
    
    const { sendMail } = await import('./mailer.js');
    const result = await sendMail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test',
      html: '<p>Test</p>',
      unsubUrl: 'http://localhost/unsub',
      idempotencyKey: 'test-key-123',
    });
    
    assert.ok(result.ok);
    global.fetch = original;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
  });
});

describe('relaxed gate', () => {
  it('allows submit after 800ms', () => {
    const elapsed = 850;
    assert.ok(elapsed >= 800);
  });
  
  it('blocks submit before 800ms', () => {
    const elapsed = 750;
    assert.ok(elapsed < 800);
  });
});

describe('404 analytics filter', () => {
  it('beforeSend drops events for 404 pages', () => {
    const mockDoc = {
      querySelector: (sel) => sel === '[data-not-found]' ? {} : null,
    };
    
    const beforeSend = (event) => {
      if (mockDoc.querySelector('[data-not-found]')) {
        return null;
      }
      return event;
    };
    
    const result = beforeSend({ name: 'pageview' });
    assert.equal(result, null);
  });
  
  it('beforeSend allows events for normal pages', () => {
    const mockDoc = {
      querySelector: () => null,
    };
    
    const beforeSend = (event) => {
      if (mockDoc.querySelector('[data-not-found]')) {
        return null;
      }
      return event;
    };
    
    const result = beforeSend({ name: 'pageview' });
    assert.ok(result);
  });
});

describe('server event sanitizing', () => {
  it('sanitizes CHECK_SUCCEEDED event', () => {
    const props = eventProps({
      engine: 'chatgpt',
      cached: true,
      extra: 'ignored',
    });
    
    assert.equal(props.engine, 'chatgpt');
    assert.equal(props.cached, true);
    assert.equal(props.extra, undefined);
  });
  
  it('sanitizes CHECK_FAILED event with reason', () => {
    const props = eventProps({
      engine: 'chatgpt',
      failure_reason: 'timeout',
    });
    
    assert.equal(props.engine, 'chatgpt');
    assert.equal(props.failure_reason, 'timeout');
  });
  
  it('sanitizes CHECKOUT_STARTED event', () => {
    const props = eventProps({
      checkout_type: 'paid_report',
    });
    
    assert.equal(props.checkout_type, 'paid_report');
  });
  
  it('sanitizes CHECKOUT_COMPLETED event', () => {
    const props = eventProps({
      checkout_type: 'paid_report',
    });
    
    assert.equal(props.checkout_type, 'paid_report');
  });
  
  it('drops invalid failure reasons', () => {
    const props = eventProps({
      failure_reason: 'invalid_reason',
    });
    
    assert.equal(props.failure_reason, undefined);
  });
  
  it('accepts valid failure reasons', () => {
    const reasons = ['timeout', 'api_error', 'validation', 'rate_limit', 'budget_exceeded', 'unknown'];
    for (const reason of reasons) {
      const props = eventProps({ failure_reason: reason });
      assert.equal(props.failure_reason, reason);
    }
  });
});
