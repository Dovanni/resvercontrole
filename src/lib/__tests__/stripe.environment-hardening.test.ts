import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Stripe environment hardening', () => {
  it('sandbox checkout consumes only TEST price and restricted key', () => {
    const billing = source('src/lib/billing.server.ts');

    expect(billing).toContain("process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST']");
    expect(billing).toContain("process.env['STRIPE_RESTRICTED_KEY_TEST']");
    expect(billing).not.toContain("process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST'] || process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY']");
    expect(billing).not.toContain("process.env['STRIPE_RESTRICTED_KEY_TEST'] || process.env['STRIPE_RESTRICTED_KEY']");
  });

  it('sandbox webhook consumes only TEST credentials and price', () => {
    const sandboxWebhook = source('src/routes/api/public/stripe-webhook.ts');

    expect(sandboxWebhook).toContain("const restrictedKey = process.env['STRIPE_RESTRICTED_KEY_TEST'];");
    expect(sandboxWebhook).toContain("const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET_TEST'];");
    expect(sandboxWebhook).toContain("const priceEnterpriseMonthly = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST'];");
    expect(sandboxWebhook).not.toContain("STRIPE_RESTRICTED_KEY_TEST'] ||");
    expect(sandboxWebhook).not.toContain("STRIPE_WEBHOOK_SECRET_TEST'] ||");
    expect(sandboxWebhook).not.toContain("STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST'] ||");
  });

  it('sandbox webhook permanently rejects livemode events', () => {
    const sandboxWebhook = source('src/routes/api/public/stripe-webhook.ts');

    expect(sandboxWebhook).toContain('if (event.livemode) {');
    expect(sandboxWebhook).not.toContain("event.livemode && process.env['STRIPE_LIVE_BILLING_ENABLED']");
    expect(sandboxWebhook).toContain('p_livemode: isLive');
    expect(sandboxWebhook).toContain('const isLive = false;');
  });

  it('live webhook remains isolated to LIVE credentials', () => {
    const liveWebhook = source('src/routes/api/public/stripe-webhook/live.ts');

    expect(liveWebhook).toContain("process.env['STRIPE_RESTRICTED_KEY_LIVE']");
    expect(liveWebhook).toContain("process.env['STRIPE_WEBHOOK_SECRET_LIVE']");
    expect(liveWebhook).toContain("process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE']");
    expect(liveWebhook).toContain('if (!event.livemode) {');
    expect(liveWebhook).not.toContain("STRIPE_RESTRICTED_KEY_TEST");
    expect(liveWebhook).not.toContain("STRIPE_WEBHOOK_SECRET_TEST");
    expect(liveWebhook).not.toContain("STRIPE_PRICE_ENTERPRISE_MONTHLY_TEST");
  });
});
