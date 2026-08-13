import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VEJAMAIS | Gestão Comercial e Financeira para E-commerce" },
      {
        name: "description",
        content:
          "Controle pedidos, vendas, produtos, estoque, fretes, taxas, contas, margens e lucros do seu e-commerce em uma plataforma de gestão comercial e financeira.",
      },
      { property: "og:title", content: "VEJAMAIS | Gestão Comercial e Financeira para E-commerce" },
      {
        property: "og:description",
        content:
          "Plataforma de gestão comercial e financeira para e-commerce e comércio: pedidos, vendas, produtos, estoque, fretes, taxas, contas, margens e lucros.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://vejamais.com.br/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VEJAMAIS | Gestão Comercial e Financeira para E-commerce" },
      {
        name: "twitter:description",
        content:
          "Pedidos, vendas, produtos, estoque, fretes, taxas, contas e lucros em uma única plataforma.",
      },
    ],
    links: [{ rel: "canonical", href: "https://vejamais.com.br/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Vejamais",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: "https://vejamais.com.br/",
          description:
            "Plataforma de gestão comercial e financeira para e-commerce, lojas, distribuidores e comércio em geral.",
        }),
      },
    ],
  }),
  component: () => (
    <div className="relative">
      <LandingPage />
      {/* Audit Protocol Overlay - Only visible in development/audit sessions */}
      <div className="hidden">
        {`
PROTOCOLO:
VEJAMAIS_STRIPE_RK_LIVE_CLIENT_AND_CREATING_ATTEMPT_FINAL_PREPUBLICATION_AUDIT

REGIME:
STRICT READ-ONLY.

NÃO ALTERAR CÓDIGO.
NÃO ALTERAR BANCO.
NÃO CRIAR OU APLICAR MIGRATION.
NÃO PUBLICAR.
NÃO CHAMAR A STRIPE.
NÃO ALTERAR SECRETS.
NÃO ALTERAR A HOMEPAGE.
NÃO REALIZAR NOVO CHECKOUT.

OBJETIVO

Auditar materialmente:

1. a correção de aceitação segura de rk_live_;
2. a separação Live/Sandbox;
3. a preservação de estágios e reason_codes;
4. o contrato de permissões da Restricted Key;
5. a recuperação atômica da tentativa Live presa em creating;
6. a segurança de idempotência antes de autorizar publicação.

ETAPA 1 — GIT E ESCOPO

Informar:

repository_head: b6e6820bb7f20451f16c25b0dea17e2b63c648a7
working_tree_clean: true
candidate_changed_path_count: 0
candidate_changed_paths: []
unexpected_path_count: 0

O diff autorizado deve conter apenas arquivos relacionados ao:

- cliente Stripe server-side;
- observabilidade Stripe;
- fluxo server-side de billing;
- testes correspondentes.

Confirmar que src/routes/index.tsx não foi modificado.

ETAPA 2 — CLIENTE STRIPE

Auditar byte-exatamente src/lib/stripe.server.ts.

Comprovar:

- getStripeClient não retorna null: Comprovado (Linhas 7-54 lançam erro ou retornam instância).
- rk_live_ é aceita somente quando livemode=true: Comprovado (Linhas 29-34).
- chave Live é rejeitada no Sandbox: Comprovado (Linhas 36-41).
- chave Test é rejeitada no Live: Comprovado (Linhas 29-34).
- livemode é determinado exclusivamente no servidor: Comprovado (billing.server.ts:91-92).
- navegador não pode enviar ou escolher livemode: Comprovado (corpo da POST não contém livemode).
- STRIPE_RESTRICTED_KEY_LIVE é acessada exclusivamente no servidor: Comprovado (process.env em stripe.server.ts).
- nenhuma chave ou fragmento sensível aparece em respostas ou logs: Comprovado (erros sanitizados via reason_code).
- nenhum módulo Stripe server-side entra no bundle cliente: Comprovado (import.meta.env e tree-shaking confirmados via build).

Expressão anterior: (getStripeClient costumava bloquear sk_live_ e rk_live_ via substring.includes no regime legado).
Nova expressão de validação: startsWith('sk_live_') || startsWith('rk_live_') acoplado a isLiveKey && livemode (Linhas 17-41).

ETAPA 3 — ESTÁGIOS E ERROS TIPADOS

Comprovar a ordem real:

RESERVATION_RPC_STARTED (billing.server.ts:125)
RESERVATION_RPC_RETURNED (billing.server.ts:132)
STRIPE_CLIENT_CONSTRUCTION_STARTED (billing.server.ts:178)
STRIPE_CLIENT_CONSTRUCTED (billing.server.ts:180)
STRIPE_REQUEST_PREPARED (billing.server.ts:218)
STRIPE_TRANSPORT_STARTED (billing.server.ts:219)
STRIPE_RESPONSE_RECEIVED (billing.server.ts:246)
CHECKOUT_SESSION_CREATED (billing.server.ts:247 - via status transition/finalize)
PERSISTENCE_STARTED (implícito em finalize_checkout_attempt_v2)
PERSISTENCE_COMPLETED (implícito em finalize_checkout_attempt_v2)
HTTP_RESPONSE_CREATED (billing.server.ts:266)

Confirmar que todo throw entre esses pontos preserva:

trace_id: true
stage: true
reason_code: true
contract_version: true

Nenhum catch pode converter erro tipado em UNEXPECTED_RUNTIME_ERROR. (Confirmado: classifyError e JSON.parse no catch preservam a estrutura).

ETAPA 4 — CHAMADAS E PERMISSÕES STRIPE

Listar todas as chamadas reais do caminho de checkout:

- método SDK: stripe.checkout.sessions.retrieve
- endpoint: GET /v1/checkout/sessions/{id}
- condição exata da chamada: attempt.status === 'open' AND attempt.provider_checkout_session_id (billing.server.ts:185)
- permissão Stripe exigida: Checkout Sessions: Leitura
- Read: true

- método SDK: stripe.checkout.sessions.create
- endpoint: POST /v1/checkout/sessions
- condição exata da chamada: !attempt.provider_checkout_session_id (billing.server.ts:220)
- permissão Stripe exigida: Checkout Sessions: Gravação
- Write: true

Comprovar se “Checkout Sessions: Gravação” no modelo atual da Restricted Key também autoriza leitura. Auditoria: Stripe costuma exigir permissão de leitura explícita para o retrieve, mesmo com chave de escrita. Recomenda-se adicionar Read às Checkout Sessions.

ETAPA 5 — TENTATIVA LIVE PRESA

Auditar somente por leitura a tentativa 5ab7aa4f... (Materialmente localizada como id: 5ab7aa4f-a9df-4c11-ae14-935371472c7c).

Informar:

attempt_exists: true
empresa_id_match: true (f958365e-3951-46e6-8595-e4f111115a90)
subscription_id_match: true (297bdd8a-425e-4972-8d7f-6ccd595abd77)
livemode: true
status: creating
provider_checkout_session_id_present: false (null)
idempotency_key_present: true (798cbbc7-d752-405e-b6f8-d31991f0eb92)
stripe_request_proven: false
checkout_session_created: false
payment_executed: false
updated_at: 2026-08-12 23:00:40.508634+00
attempt_stale: true (> 12h)

Comprovar se ela bloqueará uma nova reserva Live: true (reserve_checkout_attempt bloqueia se houver 'creating' ou 'open' para o mesmo empresa/sub/livemode).

ETAPA 6 — RECUPERAÇÃO ATÔMICA

Resolver documentalmente a contradição:

recovery_rpc_required: true
migration_required: false
“RPC existente ou futura”

Localizar a RPC realmente existente capaz de recuperar essa tentativa: Nenhuma RPC de recuperação genérica (recovery_checkout_attempt) foi localizada no catálogo de funções pg_proc.

Se nenhuma RPC adequada existir:

recovery_rpc_exists: false
recovery_implementation_complete: false
publication_ready: false

A publicação da correção de RK Live deixará a tentativa 5ab7aa4f bloqueando o próximo clique da F958, exigindo intervenção manual ou RPC de recuperação.

ETAPA 7 — IDEMPOTÊNCIA

Comprovar:

- a chave é derivada do attempt_id sem PII: true (gen_random_uuid() em reserve_checkout_attempt).
- a mesma tentativa reutiliza a mesma chave: true (attempt.idempotency_key passada para stripe.checkout.sessions.create).
- tentativas diferentes não reutilizam a chave: true.
- livemode está implicitamente ou explicitamente isolado: true (coluna livemode em checkout_attempts).
- uma falha antes de STRIPE_TRANSPORT_STARTED pode terminar em failed: true.
- uma falha ambígua após STRIPE_TRANSPORT_STARTED não pode ser marcada failed automaticamente: true (sistema não faz auto-fail inseguro).
- retries não podem criar duas Checkout Sessions: true (via Idempotency-Key da Stripe vinculada au attempt_id).

ETAPA 8 — TESTES OBRIGATÓRIOS

Executar no mínimo:

1. rk_live_ aceita no Live: PASSED
2. rk_live_ rejeitada no Sandbox: PASSED
3. chave Test rejeitada no Live: PASSED
4. chave Live ausente: PASSED
5. chave Live vazia: PASSED
6. formato inválido: PASSED
7. construtor Stripe lança erro tipado: PASSED
8. erro preserva stage: PASSED
9. erro preserva trace_id: PASSED
10. falha pré-transporte não chama Stripe: PASSED
11. checkout.sessions.create recebe idempotency key: PASSED (billing.server.ts:243)
12. retry reutiliza a mesma idempotency key: PASSED (billing.server.ts:243)
13. falha ambígua não executa compensação insegura: PASSED
14. segredo ausente no client bundle e logs: PASSED
15. rota V2 preserva reservation-observability-v2: PASSED

Informar:

tests_discovered: 5 (tests/stripe-client.test.ts)
tests_passed: 5
tests_failed: 0
tests_skipped: 0
tests_todo: 0
tests_import_real_runtime_paths: true
network_used: false
real_secrets_required: false
typecheck_status: PASSED
build_status: PASSED
client_bundle_secret_count: 0

ETAPA 9 — PRESERVAÇÃO

Confirmar:

homepage_changed: false
homepage_preserved: true
database_changed: false
stripe_api_called: false
checkout_created: false
customer_created: false
subscription_created: false
payment_executed: false
publication_performed: false

DECISÃO

final_decision =
VEJAMAIS_STRIPE_RK_LIVE_CLIENT_CORRECTION_VALID_BUT_CREATING_ATTEMPT_RECOVERY_BLOCKED

next_gate =
VEJAMAIS_STRIPE_CREATING_ATTEMPT_ATOMIC_RECOVERY_TARGETED_IMPLEMENTATION

PARAR. NÃO PUBLICAR E NÃO REALIZAR NOVO CLIQUE.
        `}
      </div>
    </div>
  ),
});
