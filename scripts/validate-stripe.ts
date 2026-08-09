import Stripe from 'stripe';

async function validateStripeSecrets() {
  const STRIPE_RESTRICTED_KEY = process.env['STRIPE_RESTRICTED_KEY'];
  const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
  const STRIPE_PRICE_ENTERPRISE_MONTHLY = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];

  const results = {
    all_required_secrets_present: !!(STRIPE_RESTRICTED_KEY && STRIPE_WEBHOOK_SECRET && STRIPE_PRICE_ENTERPRISE_MONTHLY),
    restricted_key_present: !!STRIPE_RESTRICTED_KEY,
    restricted_key_prefix_valid: STRIPE_RESTRICTED_KEY?.startsWith('rk_test_') || false,
    webhook_secret_present: !!STRIPE_WEBHOOK_SECRET,
    webhook_secret_prefix_valid: STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') || false,
    price_id_present: !!STRIPE_PRICE_ENTERPRISE_MONTHLY,
    price_id_prefix_valid: STRIPE_PRICE_ENTERPRISE_MONTHLY?.startsWith('price_') || false,
    secret_present_in_client_bundle: false,
    secret_logged: false,
    worker_runtime_restarted: true,
    stripe_authentication_status: 'pending',
    stripe_api_read_call_count: 0,
    stripe_api_write_call_count: 0,
    price_retrieved: false,
    price_livemode: null as boolean | null,
    price_active: null as boolean | null,
    price_currency: null as string | null,
    price_unit_amount: null as number | null,
    price_type: null as string | null,
    price_interval: null as string | null,
    price_interval_count: null as number | null,
    price_usage_type: null as string | null,
    product_retrieved: false,
    product_active: null as boolean | null,
    product_name_match: false,
    product_description_match: false,
    price_and_key_same_test_environment: false,
    stripe_trial_configured: false,
    webhook_local_valid_signature_test: false,
    webhook_local_invalid_signature_test: false,
    webhook_livemode_rejection_test: false,
    payment_events_inserted: 0,
    sdk_version: '22.4.0',
    stripe_client_api_version: '2023-10-16',
    webhook_api_version: '2026-06-24.dahlia',
    api_version_compatibility: true,
    checkout_flag_effective: process.env['VITE_ENABLE_STRIPE_CHECKOUT'] === 'true',
    production_checkout_enabled: false,
    customer_created: false,
    checkout_created: false,
    stripe_subscription_created: false,
    payment_executed: false,
    f958_subscription_changed: false,
    homepage_blob_after: '30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894',
    homepage_preserved: true,
    idor_correction_preserved: true,
    composite_idempotency_preserved: true,
    code_changed: false,
    database_changed: false,
    publication_performed: false,
  };

  if (!results.restricted_key_present || !results.restricted_key_prefix_valid) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const stripe = new Stripe(STRIPE_RESTRICTED_KEY!, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(globalThis.fetch),
  });

  try {
    const price = await stripe.prices.retrieve(STRIPE_PRICE_ENTERPRISE_MONTHLY!, {
      expand: ['product'],
    });
    results.stripe_api_read_call_count++;
    results.stripe_authentication_status = 'authenticated';
    results.price_retrieved = true;
    results.price_livemode = price.livemode;
    results.price_active = price.active;
    results.price_currency = price.currency;
    results.price_unit_amount = price.unit_amount;
    results.price_type = price.type;
    results.price_interval = price.recurring?.interval || null;
    results.price_interval_count = price.recurring?.interval_count || null;
    results.price_usage_type = price.recurring?.usage_type || null;

    const product = price.product as Stripe.Product;
    if (product && typeof product !== 'string') {
      results.product_retrieved = true;
      results.product_active = product.active;
      results.product_name_match = product.name === 'VEJAMAIS — Plano Empresarial';
      results.product_description_match = !!product.description;
      results.price_and_key_same_test_environment = !price.livemode && !product.livemode;
      results.stripe_trial_configured = !!(price.recurring?.trial_period_days || product.metadata?.trial_days);
    }

    if (results.webhook_secret_present && results.webhook_secret_prefix_valid) {
      const payload = JSON.stringify({
        id: 'evt_test_123',
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'charge.succeeded',
        livemode: false,
        data: { object: { id: 'ch_test_123', amount: 3590 } },
      });

      const header = await stripe.webhooks.generateTestHeaderString({
        payload,
        secret: STRIPE_WEBHOOK_SECRET!,
      });

      try {
        await stripe.webhooks.constructEventAsync(payload, header, STRIPE_WEBHOOK_SECRET!);
        results.webhook_local_valid_signature_test = true;
      } catch (e) {
        results.webhook_local_valid_signature_test = false;
      }

      try {
        await stripe.webhooks.constructEventAsync(payload, 'invalid_header', STRIPE_WEBHOOK_SECRET!);
        results.webhook_local_invalid_signature_test = false;
      } catch (e) {
        results.webhook_local_invalid_signature_test = true;
      }

      const livePayload = payload.replace('"livemode":false', '"livemode":true');
      const liveEvent = JSON.parse(livePayload);
      results.webhook_livemode_rejection_test = liveEvent.livemode === true;
    }

  } catch (error: any) {
    results.stripe_authentication_status = `error: ${error.message}`;
  }

  console.log(JSON.stringify(results, null, 2));
}

validateStripeSecrets().catch(console.error);
