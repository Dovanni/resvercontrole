import Stripe from 'stripe';
import { createFileRoute } from '@tanstack/react-router';

/**
 * PROTOCOLO: VEJAMAIS_STRIPE_DURABLE_DIAGNOSTICS_TARGETED_CORRECTION
 * Descrição: Handler resiliente com observabilidade persistente e boundary de segurança.
 */

// --- Tipagem e Constantes ---

type AllowedStage =
  | 'SIGNATURE_VALIDATED'
  | 'PAYLOAD_SANITIZED'
  | 'RPC_CALL_STARTED'
  | 'RPC_RESPONSE_RECEIVED'
  | 'HTTP_RESPONSE_READY';

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

// Circuit Breaker State
export let diagnosticsFailed = false;
export const resetDiagnostics = () => { diagnosticsFailed = false; };

// Helper para Log Persistente (Checkpoints)
async function safeLogDiagnostic(
  trace_id: string,
  event_id: string | undefined,
  event_type: string,
  stage: AllowedStage,
  reason_code?: AllowedReasonCode,
  status: number = 200
) {
  if (diagnosticsFailed) return;

  const supabaseUrl = process.env['VITE_SUPABASE_URL'];
  const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const diagnosticsEnabled = process.env['STRIPE_WEBHOOK_DIAGNOSTICS_ENABLED'] === 'true';

  if (!diagnosticsEnabled || !supabaseUrl || !supabaseServiceRoleKey) return;

  try {
    // 1. Sanitização do Event ID (PII)
    let eventHash = '0000000000000000000000000000000000000000000000000000000000000000';
    if (event_id) {
      const msgUint8 = new TextEncoder().encode(event_id);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      eventHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 2. AbortController para Timeout de 300ms
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300);

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/log_stripe_webhook_diagnostic`, {
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

    if (!response.ok) {
        throw new Error(`Diagnostic RPC failed with status ${response.status}`);
    }
  } catch (err) {
    // Fail-open: Não derruba o handler principal
    diagnosticsFailed = true; // Circuit Breaker acionado
    console.error(`[${trace_id}] Persistent Diagnostic Failed - Circuit Breaker ON`, err);
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
  // O log de saída é o último checkpoint permitido (HTTP_RESPONSE_READY)
  await safeLogDiagnostic(trace_id, event_id, event_type, stage, reason_code, status);

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

// --- Handler ---

export const Route = createFileRoute('/api/public/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        let currentStage: AllowedStage = 'SIGNATURE_VALIDATED'; // O primeiro checkpoint persistente só após validação
        let eventId: string | undefined;
        let eventType: string = 'UNKNOWN';

        try {
          const signature = request.headers.get('stripe-signature');
          if (!signature) {
             // Sem escrita diagnóstica antes da assinatura
            return new Response(JSON.stringify({ error: 'UNAUTHORIZED', trace_id: traceId }), { status: 401 });
          }

          const restrictedKey = process.env['STRIPE_RESTRICTED_KEY'];
          const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'] || '';

          if (!restrictedKey) {
            console.error(`[${traceId}] Configuration Error: Missing STRIPE_RESTRICTED_KEY`);
            return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', trace_id: traceId }), { status: 500 });
          }

          const stripe = new Stripe(restrictedKey, {
            httpClient: Stripe.createFetchHttpClient(),
          });

          // 1. Leitura do Corpo (Raw)
          let bodyText: string;
          try {
            bodyText = await request.text();
          } catch (err) {
            return new Response(JSON.stringify({ error: 'BAD_REQUEST', trace_id: traceId }), { status: 400 });
          }

          // 2. Validação da Assinatura
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
            return new Response(JSON.stringify({ error: 'INVALID_SIGNATURE', trace_id: traceId }), { status: 400 });
          }

          eventId = event.id;
          eventType = event.type;

          if (event.livemode) {
             return new Response(JSON.stringify({ error: 'LIVEMODE_REJECTED', trace_id: traceId }), { status: 400 });
          }

          // --- FAST PATH: checkout.session.expired ---
          if (event.type === 'checkout.session.expired') {
            const eventObject = event.data.object as Stripe.Checkout.Session;
            const sessionId = eventObject.id;

            if (!sessionId) {
              return await createSanitizedResponse(400, traceId, 'SIGNATURE_VALIDATED', 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
            }

            // Checkpoint 1: SIGNATURE_VALIDATED
            await safeLogDiagnostic(traceId, eventId, eventType, 'SIGNATURE_VALIDATED');

            // Preparar payload SHA256 (sanitizado, sem PII)
            const msgUint8 = new TextEncoder().encode(bodyText);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const payloadHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const supabaseUrl = process.env['VITE_SUPABASE_URL'];
            const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

            if (!supabaseUrl || !supabaseServiceRoleKey) {
              console.error(`[${traceId}] Configuration Error: Missing Supabase env vars for fast path`);
              return await createSanitizedResponse(500, traceId, 'SIGNATURE_VALIDATED', 'UNEXPECTED_HANDLER_FAILURE', eventId, eventType);
            }

            // Chamada RPC dedicada
            let rpcResponse: Response;
            try {
              rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/process_stripe_checkout_session_expired`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                  'apikey': supabaseServiceRoleKey
                },
                body: JSON.stringify({
                  p_provider_event_id: event.id,
                  p_provider_session_id: sessionId,
                  p_event_created: event.created,
                  p_payload_sha256: payloadHash,
                  p_livemode: false
                })
              });
            } catch (err) {
              return await createSanitizedResponse(503, traceId, 'RPC_CALL_STARTED', 'RPC_TRANSPORT_FAILED', eventId, eventType);
            }

            if (!rpcResponse.ok) {
              return await createSanitizedResponse(500, traceId, 'RPC_RESPONSE_RECEIVED', 'RPC_RESPONSE_INVALID', eventId, eventType);
            }

            const result = (await rpcResponse.json()) as string;
            
            if (result === 'processed' || result === 'duplicate' || result === 'already_expired' || result === 'ignored_terminal') {
              return await createSanitizedResponse(200, traceId, 'HTTP_RESPONSE_READY', undefined, eventId, eventType);
            }
            
            if (result === 'failed_retryable') {
              return await createSanitizedResponse(503, traceId, 'RPC_RESPONSE_RECEIVED', 'RPC_REJECTED_RETRYABLE', eventId, eventType);
            }

            return await createSanitizedResponse(400, traceId, 'RPC_RESPONSE_RECEIVED', 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
          }
          // --- END FAST PATH ---


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
            return new Response(JSON.stringify({ error: 'UNSUPPORTED_EVENT', trace_id: traceId }), { status: 200 });
          }

          // CHECKPOINT 1: SIGNATURE_VALIDATED (Somente após livemode e type check)
          currentStage = 'SIGNATURE_VALIDATED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);

          // 3. Sanitização e Contrato do Payload
          const eventObject = event.data.object;
          if (!isObject(eventObject)) {
            return await createSanitizedResponse(400, traceId, currentStage, 'PAYLOAD_CONTRACT_FAILED', eventId, eventType);
          }

          // CHECKPOINT 2: PAYLOAD_SANITIZED
          currentStage = 'PAYLOAD_SANITIZED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);

          const supabaseUrl = process.env['VITE_SUPABASE_URL'];
          const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
          const priceEnterpriseMonthly = process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'];
          
          if (!supabaseUrl || !supabaseServiceRoleKey || !priceEnterpriseMonthly) {
            console.error(`[${traceId}] Configuration Error: Missing Supabase/Stripe env vars`);
            return await createSanitizedResponse(500, traceId, currentStage, 'UNEXPECTED_HANDLER_FAILURE', eventId, eventType);
          }

          const metadata = (eventObject.metadata as Record<string, string | undefined>) || {};
          let internalSubscriptionId = metadata.internal_subscription_id;
          const legacySubscriptionId = metadata.subscription_id;

          if (!internalSubscriptionId && legacySubscriptionId) {
            internalSubscriptionId = legacySubscriptionId;
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

          // CHECKPOINT 3: RPC_CALL_STARTED
          currentStage = 'RPC_CALL_STARTED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);

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
            return await createSanitizedResponse(503, traceId, currentStage, 'RPC_TRANSPORT_FAILED', eventId, eventType);
          }

          // CHECKPOINT 4: RPC_RESPONSE_RECEIVED
          currentStage = 'RPC_RESPONSE_RECEIVED';
          await safeLogDiagnostic(traceId, eventId, eventType, currentStage);

          if (!rpcResponse.ok) {
            let errorDetail = '';
            try {
              errorDetail = await rpcResponse.text();
            } catch (e) {
              errorDetail = 'COULD_NOT_READ_ERROR_BODY';
            }
            
            if (errorDetail.includes('UNLINKED') || rpcResponse.status === 503) {
              return await createSanitizedResponse(503, traceId, currentStage, 'RPC_REJECTED_RETRYABLE', eventId, eventType);
            }
            return await createSanitizedResponse(500, traceId, currentStage, 'RPC_RESPONSE_INVALID', eventId, eventType);
          }

          const result = (await rpcResponse.json()) as { status?: string };
          
          if (result.status === 'failed_retryable') {
             return await createSanitizedResponse(503, traceId, currentStage, 'RPC_REJECTED_RETRYABLE', eventId, eventType);
          }
          
          if (result.status === 'rejected_permanent') {
            return await createSanitizedResponse(200, traceId, currentStage, 'RPC_REJECTED_PERMANENT', eventId, eventType);
          }

          // CHECKPOINT 5: HTTP_RESPONSE_READY (Final)
          return await createSanitizedResponse(200, traceId, 'HTTP_RESPONSE_READY', undefined, eventId, eventType);
          
        } catch (err) {
          console.error(`[${traceId}] Unexpected Handler Failure`, err);
          return await createSanitizedResponse(500, traceId, currentStage, 'UNEXPECTED_HANDLER_FAILURE', eventId, eventType);
        }
      },
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
    },
  },
});
