import Stripe from 'stripe';
import { createFileRoute } from '@tanstack/react-router';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_PRODUCTION_RUNTIME_SANITIZED_OBSERVABILITY_MINIMAL_IMPLEMENTATION
 * Descrição: Handler resiliente com observabilidade sanitizada e boundary de segurança.
 */

// --- Tipagem e Constantes (ETAPA 1) ---

type AllowedStage =
  | 'REQUEST_RECEIVED'
  | 'RAW_BODY_READ'
  | 'SIGNATURE_VALIDATED'
  | 'EVENT_PARSED'
  | 'LIVEMODE_VALIDATED'
  | 'EVENT_SUPPORTED'
  | 'PAYLOAD_SANITIZED'
  | 'RPC_CALL_STARTED'
  | 'RPC_RESPONSE_RECEIVED'
  | 'RPC_RESULT_CLASSIFIED'
  | 'HTTP_RESPONSE_CREATED';

type AllowedReasonCode =
  | 'RAW_BODY_READ_FAILED'
  | 'SIGNATURE_INVALID'
  | 'EVENT_PARSE_FAILED'
  | 'LIVEMODE_REJECTED'
  | 'UNSUPPORTED_EVENT'
  | 'PAYLOAD_CONTRACT_FAILED'
  | 'RPC_TRANSPORT_FAILED'
  | 'RPC_REJECTED_RETRYABLE'
  | 'RPC_REJECTED_PERMANENT'
  | 'RPC_RESPONSE_INVALID'
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

// --- Helpers (ETAPA 3) ---

function createSanitizedResponse(
  status: number,
  trace_id: string,
  stage: AllowedStage,
  reason_code?: AllowedReasonCode
): Response {
  const body = {
    error: status >= 400 ? 'WEBHOOK_PROCESSING_FAILED' : undefined,
    trace_id,
    stage,
    reason_code,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

// --- Handler (ETAPA 2) ---

export const Route = createFileRoute('/api/public/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const traceId = crypto.randomUUID();
        let stage: AllowedStage = 'REQUEST_RECEIVED';

        try {
          const signature = request.headers.get('stripe-signature');
          if (!signature) {
            return createSanitizedResponse(400, traceId, 'REQUEST_RECEIVED', 'SIGNATURE_INVALID');
          }

          const restrictedKey = process.env['STRIPE_RESTRICTED_KEY'];
          const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'] || '';

          if (!restrictedKey) {
            console.error(`[${traceId}] Configuration Error: Missing STRIPE_RESTRICTED_KEY`);
            return createSanitizedResponse(500, traceId, 'REQUEST_RECEIVED', 'UNEXPECTED_HANDLER_FAILURE');
          }

          const stripe = new Stripe(restrictedKey, {
            httpClient: Stripe.createFetchHttpClient(),
          });

          // ETAPA 2: Boundary - request.text()
          stage = 'RAW_BODY_READ';
          let bodyText: string;
          try {
            bodyText = await request.text();
          } catch (err) {
            return createSanitizedResponse(400, traceId, stage, 'RAW_BODY_READ_FAILED');
          }

          // ETAPA 2: Boundary - constructEventAsync
          stage = 'SIGNATURE_VALIDATED';
          let event: Stripe.Event;
          try {
            event = await stripe.webhooks.constructEventAsync(
              bodyText,
              signature,
              endpointSecret,
              undefined,
              Stripe.createSubtleCryptoProvider()
            );
          } catch (err) {
            return createSanitizedResponse(400, traceId, stage, 'SIGNATURE_INVALID');
          }

          // ETAPA 2: Boundary - narrowing do evento
          stage = 'EVENT_PARSED';
          if (!event || !event.type || !event.data) {
            return createSanitizedResponse(400, traceId, stage, 'EVENT_PARSE_FAILED');
          }

          // ETAPA 4: Status HTTP - livemode
          stage = 'LIVEMODE_VALIDATED';
          if (event.livemode) {
            return createSanitizedResponse(400, traceId, stage, 'LIVEMODE_REJECTED');
          }

          // ETAPA 4: Status HTTP - evento não suportado
          stage = 'EVENT_SUPPORTED';
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
            return createSanitizedResponse(200, traceId, stage, 'UNSUPPORTED_EVENT');
          }

          // ETAPA 2: Boundary - sanitização
          stage = 'PAYLOAD_SANITIZED';
          const eventObject = event.data.object;
          if (!isObject(eventObject)) {
            return createSanitizedResponse(400, traceId, stage, 'PAYLOAD_CONTRACT_FAILED');
          }

          const supabaseUrl = process.env['VITE_SUPABASE_URL'];
          const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
          const priceEnterpriseMonthly = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];
          
          if (!supabaseUrl || !supabaseServiceRoleKey || !priceEnterpriseMonthly) {
            console.error(`[${traceId}] Configuration Error: Missing Supabase/Stripe env vars`);
            return createSanitizedResponse(500, traceId, stage, 'UNEXPECTED_HANDLER_FAILURE');
          }

          const metadata = (eventObject.metadata as Record<string, string | undefined>) || {};
          let internalSubscriptionId = metadata.internal_subscription_id;
          const legacySubscriptionId = metadata.subscription_id;

          if (!internalSubscriptionId && legacySubscriptionId) {
            internalSubscriptionId = legacySubscriptionId;
          } else if (internalSubscriptionId && legacySubscriptionId && internalSubscriptionId !== legacySubscriptionId) {
            return createSanitizedResponse(400, traceId, stage, 'PAYLOAD_CONTRACT_FAILED');
          }

          if (internalSubscriptionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(internalSubscriptionId)) {
            return createSanitizedResponse(400, traceId, stage, 'PAYLOAD_CONTRACT_FAILED');
          }

          const effectiveMetadata = { 
            ...metadata,
            internal_subscription_id: internalSubscriptionId 
          };
          
          const payload: WebhookRpcPayload = {
            p_provider_event_id: event.id,
            p_event_type: event.type,
            p_payload_sha256: null,
            p_livemode: false,
            p_event_data: {
              id: String(eventObject.id || ''),
              object: eventObject,
              customer: eventObject.customer,
              subscription: eventObject.subscription,
              status: eventObject.status,
              metadata: effectiveMetadata,
              plan_code: metadata.plan_code || 'enterprise_monthly'
            },
            p_event_created: event.created,
            p_canonical_plan_code: metadata.plan_code || 'enterprise_monthly',
            p_canonical_price_id: priceEnterpriseMonthly,
            p_canonical_currency: 'brl',
            p_canonical_amount: 3590
          };

          // ETAPA 2: Boundary - chamada RPC
          stage = 'RPC_CALL_STARTED';
          let rpcResponse: Response;
          try {
            rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/process_stripe_webhook_event`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                'apikey': supabaseServiceRoleKey
              },
              body: JSON.stringify(payload)
            });
          } catch (err) {
            return createSanitizedResponse(503, traceId, stage, 'RPC_TRANSPORT_FAILED');
          }

          stage = 'RPC_RESPONSE_RECEIVED';
          if (!rpcResponse.ok) {
            let errorDetail = '';
            try {
              errorDetail = await rpcResponse.text();
            } catch (e) {
              errorDetail = 'COULD_NOT_READ_ERROR_BODY';
            }
            
            console.error(`[${traceId}] RPC Error ${rpcResponse.status}: ${errorDetail}`);
            
            if (errorDetail.includes('UNLINKED') || rpcResponse.status === 503) {
              return createSanitizedResponse(503, traceId, stage, 'RPC_REJECTED_RETRYABLE');
            }
            // Falha não-retryable do banco ou erro inesperado
            return createSanitizedResponse(500, traceId, stage, 'RPC_RESPONSE_INVALID');
          }

          // ETAPA 2: Boundary - classificação do resultado
          stage = 'RPC_RESULT_CLASSIFIED';
          const result = (await rpcResponse.json()) as { status?: string };
          
          if (result.status === 'failed_retryable') {
             return createSanitizedResponse(503, traceId, stage, 'RPC_REJECTED_RETRYABLE');
          }

          if (result.status === 'rejected_permanent') {
            // Rejeição permanente validada e registrada deve retornar 200 conforme Etapa 4
            return createSanitizedResponse(200, traceId, stage, 'RPC_REJECTED_PERMANENT');
          }

          // ETAPA 5: Log Sanitizado
          const elapsed = Date.now() - startedAt;
          console.info(JSON.stringify({
            trace_id: traceId,
            stage: 'HTTP_RESPONSE_CREATED',
            event_type: event.type,
            livemode: event.livemode,
            http_status: 200,
            elapsed_ms: elapsed
          }));

          return createSanitizedResponse(200, traceId, 'HTTP_RESPONSE_CREATED');

        } catch (err) {
          // ETAPA 2: Boundary externo global
          console.error(`[${traceId}] Unexpected Handler Failure: Sanitized boundary active.`);
          return createSanitizedResponse(500, traceId, stage, 'UNEXPECTED_HANDLER_FAILURE');
        }
      },
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
    },
  },
});
