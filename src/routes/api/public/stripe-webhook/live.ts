import Stripe from 'stripe';
import { createFileRoute } from '@tanstack/react-router';

type AllowedStage =
  | 'SIGNATURE_VALIDATED'
  | 'FAST_PATH_ENTERED'
  | 'PAYLOAD_HASH_STARTED'
  | 'PAYLOAD_HASH_CREATED'
  | 'SERVER_CONFIGURATION_VALIDATED'
  | 'RPC_REQUEST_PREPARED'
  | 'RPC_CALL_STARTED'
  | 'RPC_RESPONSE_RECEIVED'
  | 'RPC_ACK_PARSED'
  | 'HTTP_RESPONSE_READY'
  | 'PAYLOAD_SANITIZED'
  | 'HTTP_RESPONSE_CREATED';

type AllowedReasonCode =
  | 'RAW_BODY_READ_FAILED'
  | 'SIGNATURE_INVALID'
  | 'EVENT_PARSE_FAILED'
  | 'LIVEMODE_REJECTED'
  | 'UNSUPPORTED_EVENT'
  | 'PAYLOAD_CONTRACT_FAILED'
  | 'RPC_TRANSPORT_FAILED'
  | 'RPC_TRANSPORT_RETRYABLE'
  | 'RPC_REJECTED_RETRYABLE'
  | 'RPC_REJECTED_PERMANENT'
  | 'RPC_RESPONSE_INVALID'
  | 'SERVER_CONFIGURATION_MISSING'
  | 'SERVER_CONFIGURATION_INVALID'
  | 'PAYLOAD_HASH_FAILED'
  | 'RPC_REQUEST_SERIALIZATION_FAILED'
  | 'UNEXPECTED_HANDLER_FAILURE';

interface WebhookRpcPayload {
  p_provider_event_id: string;
  p_event_type: string;
  p_payload_sha256: string | null;
  p_livemode: boolean;
  p_event_data: {
    id: string;
    object: unknown;
    customer: string | null | unknown;
    subscription: string | null | unknown;
    status: string | null | unknown;
    metadata: Record<string, string | undefined>;
    plan_code: string;
  };
  p_event_created: number;
  p_canonical_plan_code: string;
  p_canonical_price_id: string | undefined;
  p_canonical_currency: string;
  p_canonical_amount: number;
}

function isObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function metadataFromObject(obj: Record<string, any>): Record<string, string | undefined> {
  if (isObject(obj.metadata)) return obj.metadata as Record<string, string | undefined>;
  return {};
}

function invoiceSubscriptionContext(obj: Record<string, any>) {
  const topLevelSubscription = typeof obj.subscription === 'string' ? obj.subscription : null;
  const parent = isObject(obj.parent) ? obj.parent : null;
  const subscriptionDetails = parent && isObject(parent.subscription_details) ? parent.subscription_details : null;
  const nestedSubscription = subscriptionDetails && typeof subscriptionDetails.subscription === 'string'
    ? subscriptionDetails.subscription
    : null;
  const nestedMetadata = subscriptionDetails && isObject(subscriptionDetails.metadata)
    ? subscriptionDetails.metadata as Record<string, string | undefined>
    : {};
  return { subscription: topLevelSubscription || nestedSubscription, metadata: nestedMetadata };
}

async function safeLogDiagnostic(
  trace_id: string,
  event_id: string | undefined,
  event_type: string,
  stage: AllowedStage,
  reason_code?: AllowedReasonCode,
  status: number = 200
) {
  const supabaseUrl = process.env['VITE_SUPABASE_URL'];
  const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const diagnosticsEnabled = process.env['STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED'] === 'true';
  if (!diagnosticsEnabled || !supabaseUrl || !supabaseServiceRoleKey) return;

  try {
    let eventHash = '0000000000000000000000000000000000000000000000000000000000000000';
    if (event_id) {
      const bytes = new TextEncoder().encode(event_id);
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      eventHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300);
    await fetch(`${supabaseUrl}/rest/v1/rpc/log_stripe_webhook_diagnostic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey
      },
      body: JSON.stringify({
        p_trace_id: trace_id,
        p_event_id_hash: eventHash,
        p_event_type: event_type,
        p_stage: stage,
        p_reason_code: reason_code,
        p_http_status: status
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch {
    // Diagnostics are fail-open and never influence billing state.
  }
}

async function createSanitizedResponse(
  status: number,
  trace_id: string,
  stage: AllowedStage,
  reason_code?: AllowedReasonCode,
  event_id?: string,
  event_type: string = 'UNKNOWN'
): Promise<Response> {
  await safeLogDiagnostic(trace_id, event_id, event_type, stage, reason_code, status);
  return new Response(JSON.stringify({
    error: status >= 400 ? 'WEBHOOK_PROCESSING_FAILED' : undefined,
    trace_id,
    stage,
    reason_code,
  }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const Route = createFileRoute('/api/public/stripe-webhook/live')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        let currentStage: AllowedStage = 'SIGNATURE_VALIDATED';
        let eventId: string | undefined;
        let eventType = 'UNKNOWN';

        try {
          const signature = request.headers.get('stripe-signature');
          if (!signature) return new Response(JSON.stringify({ error: 'UNAUTHORIZED', trace_id: traceId }), { status: 401 });

          const restrictedKeyLive = process.env['STRIPE_RESTRICTED_KEY_LIVE'];
          const endpointSecretLive = process.env['STRIPE_WEBHOOK_SECRET_LIVE'];
          if (!restrictedKeyLive || !endpointSecretLive) {
            return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', trace_id: traceId }), { status: 500 });
          }

          const stripe = new Stripe(restrictedKeyLive, { httpClient: Stripe.createFetchHttpClient() });
          let bodyText: string;
          try {
            bodyText = await request.text();
          } catch {
            return new Response(JSON.stringify({ error: 'BAD_REQUEST', trace_id: traceId }), { status: 400 });
          }

          let event: Stripe.Event;
          try {
            event = await stripe.webhooks.constructEventAsync(
              bodyText,
              signature,
              endpointSecretLive,
              undefined,
              Stripe.createSubtleCryptoProvider()
            );
          } catch {
            return new Response(JSON.stringify({ error: 'INVALID_SIGNATURE', trace_id: traceId }), { status: 400 });
          }

          eventId = event.id;
          eventType = event.type;
          if (!event.livemode) {
            return createSanitizedResponse(400, traceId, currentStage, 'LIVEMODE_REJECTED', eventId, eventType);
          }

          const supportedEvents = [
            'checkout.session.completed',
            'checkout.session.expired',
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'invoice.paid',
            'invoice.payment_failed'
          ];
          if (!supportedEvents.includes(event.type)) {
            return createSanitizedResponse(200, traceId, currentStage, 'UNSUPPORTED_EVENT', eventId, eventType);
          }

          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);
          const eventObject = event.data.object;
          if (!isObject(eventObject)) {
            return createSanitizedResponse(400, traceId, currentStage, 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
          }

          currentStage = 'PAYLOAD_SANITIZED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);

          const supabaseUrl = process.env['VITE_SUPABASE_URL'];
          const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
          const priceEnterpriseMonthlyLive = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE'];
          if (!supabaseUrl || !supabaseServiceRoleKey || !priceEnterpriseMonthlyLive) {
            return createSanitizedResponse(500, traceId, currentStage, 'SERVER_CONFIGURATION_MISSING', eventId, eventType);
          }

          // Canonical live contract: exact price, BRL, R$ 35.90 for subscription events.
          if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
            const firstItem = isObject(eventObject.items) && Array.isArray(eventObject.items.data)
              ? eventObject.items.data[0]
              : null;
            const price = isObject(firstItem) && isObject(firstItem.price) ? firstItem.price : null;
            if (!price || price.id !== priceEnterpriseMonthlyLive || String(price.currency || '').toLowerCase() !== 'brl' || Number(price.unit_amount) !== 3590) {
              return createSanitizedResponse(400, traceId, currentStage, 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
            }
          }

          const invoiceContext = invoiceSubscriptionContext(eventObject);
          if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
            const currency = String(eventObject.currency || '').toLowerCase();
            const amountPaid = Number(eventObject.amount_paid ?? 0);
            const amountDue = Number(eventObject.amount_due ?? 0);
            if (currency !== 'brl') {
              return createSanitizedResponse(400, traceId, currentStage, 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
            }

            // Stripe creates a zero-value invoice when a trial starts. It must never activate paid access.
            if (event.type === 'invoice.paid' && amountPaid === 0) {
              return createSanitizedResponse(200, traceId, 'HTTP_RESPONSE_READY', undefined, eventId, eventType);
            }
            if (event.type === 'invoice.paid' && amountPaid !== 3590) {
              return createSanitizedResponse(400, traceId, currentStage, 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
            }
            if (event.type === 'invoice.payment_failed' && amountDue !== 3590) {
              return createSanitizedResponse(400, traceId, currentStage, 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
            }
          }

          const directMetadata = metadataFromObject(eventObject);
          const metadata = Object.keys(directMetadata).length > 0 ? directMetadata : invoiceContext.metadata;
          const internalSubscriptionId = metadata.internal_subscription_id || metadata.subscription_id;
          const stripeSubscription = eventObject.subscription || invoiceContext.subscription;

          const payload: WebhookRpcPayload = {
            p_provider_event_id: event.id,
            p_event_type: event.type,
            p_payload_sha256: null,
            p_livemode: true,
            p_event_data: {
              id: String(eventObject.id || ''),
              object: eventObject,
              customer: eventObject.customer,
              subscription: stripeSubscription,
              status: eventObject.status,
              metadata: { ...metadata, internal_subscription_id: internalSubscriptionId },
              plan_code: metadata.plan_code || 'enterprise_monthly'
            },
            p_event_created: event.created,
            p_canonical_plan_code: 'enterprise_monthly',
            p_canonical_price_id: priceEnterpriseMonthlyLive,
            p_canonical_currency: 'brl',
            p_canonical_amount: 3590
          };

          currentStage = 'RPC_CALL_STARTED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);
          const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/process_stripe_webhook_event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
              'apikey': supabaseServiceRoleKey
            },
            body: JSON.stringify(payload)
          });

          currentStage = 'RPC_RESPONSE_RECEIVED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);
          if (!rpcResponse.ok) {
            return createSanitizedResponse(503, traceId, currentStage, 'RPC_TRANSPORT_RETRYABLE', eventId, eventType);
          }

          const result = (await rpcResponse.json()) as { status?: string };
          if (result.status === 'failed_retryable') {
            return createSanitizedResponse(503, traceId, currentStage, 'RPC_REJECTED_RETRYABLE', eventId, eventType);
          }
          if (result.status === 'rejected_permanent') {
            return createSanitizedResponse(400, traceId, currentStage, 'RPC_REJECTED_PERMANENT', eventId, eventType);
          }

          return createSanitizedResponse(200, traceId, 'HTTP_RESPONSE_READY', undefined, eventId, eventType);
        } catch (err) {
          console.error(`[${traceId}] Unexpected Live Handler Failure`, err);
          return createSanitizedResponse(500, traceId, currentStage, 'UNEXPECTED_HANDLER_FAILURE', eventId, eventType);
        }
      },
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
    },
  },
});
