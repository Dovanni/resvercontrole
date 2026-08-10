PROTOCOLO: VEJAMAIS_STRIPE_CHECKOUT_EXPIRED_INTERNAL_SESSION_LINKAGE_MINIMAL_CORRECTION

AUTORIZAÇÃO LIMITADA para corrigir exclusivamente o branch checkout.session.expired da RPC:

public.process_stripe_webhook_event(
  text,
  text,
  text,
  boolean,
  jsonb,
  bigint,
  text,
  text,
  text,
  bigint
)

NÃO alterar assinatura da RPC.
NÃO alterar handler, checkout, planos, assinatura ou homepage.
NÃO criar Checkout Session.
NÃO chamar Stripe API.
NÃO reenviar evento manualmente.
NÃO publicar frontend.
NÃO executar correção manual da linha F958.

1. INVARIANTE CANÔNICO

Para checkout.session.expired, a autoridade primária deve ser:

provider = 'stripe'
+
provider_checkout_session_id persistido na checkout_attempts

A RPC deve extrair o Session ID somente de:

p_event_data->'object'->>'id'

Em seguida:

- validar que o valor não está vazio;
- localizar checkout_attempts pelo provider e provider_checkout_session_id;
- executar SELECT ... FOR UPDATE;
- derivar empresa_id, subscription_id e attempt_id exclusivamente da linha bloqueada;
- não depender obrigatoriamente de internal_subscription_id na metadata;
- não executar cast UUID antes de validar presença e formato.

2. ORDEM DO BRANCH

O branch checkout.session.expired deve ser processado antes de qualquer validação genérica que exija:

v_internal_sub_id IS NOT NULL
ou
(metadata->>'internal_subscription_id')::UUID

Para o evento expirado:

- metadata ausente deve ser aceita quando a sessão persistida for encontrada;
- metadata legada ou canônica, quando presente, é apenas confirmação secundária;
- metadata nunca pode substituir a autoridade da linha interna.

3. VALIDAÇÃO SECUNDÁRIA FAIL-CLOSED

Se presentes, comparar contra a linha bloqueada:

- attempt_id;
- empresa_id;
- internal_subscription_id ou subscription_id normalizado;
- plan_code.

Regras:

- valores iguais: continuar;
- valor ausente: permitido para checkout.session.expired;
- valor malformado: rejeitar permanentemente;
- valor divergente: rejeitar permanentemente;
- sessão desconhecida: failed_retryable;
- nenhuma correspondência cross-company permitida.

4. TRANSIÇÃO ATÔMICA

Quando a tentativa for encontrada:

- permitir open → expired;
- permitir idempotência de expired → expired;
- preservar provider_checkout_session_id;
- não alterar subscriptions;
- não criar customer;
- não criar Stripe Subscription;
- não criar invoice;
- não executar pagamento;
- registrar payment_events atomicamente;
- preservar UNIQUE(provider, provider_event_id);
- retornar processed para HTTP 200.

Quando não vinculada:

- retornar failed_retryable para HTTP 503;
- não finalizar definitivamente a idempotência;
- permitir tentativa posterior.

5. MIGRATION VERSIONADA

Criar nova migration contendo somente:

- CREATE OR REPLACE da função;
- owner postgres;
- SECURITY DEFINER;
- search_path fixo;
- ACL restrita.

Reaplicar:

REVOKE ALL FROM PUBLIC;
REVOKE ALL FROM anon;
REVOKE ALL FROM authenticated;
GRANT EXECUTE TO service_role;

Informar:

migration_exact_path
migration_sha256
migration_registry_match
rpc_signature_changed: false
rpc_return_type_changed: false
unrelated_database_objects_changed: false

6. TESTES SQL TRANSACIONAIS REAIS

Além dos testes unitários, testar a função SQL implantada usando uma única transação controlada com ROLLBACK obrigatório.

Se o ambiente não garantir BEGIN/ROLLBACK na mesma conexão, NÃO executar testes com escrita.

Cenários:

1. sessão persistida + metadata ausente → processed;
2. sessão persistida + subscription_id legado → processed;
3. sessão persistida + internal_subscription_id → processed;
4. ambas as chaves iguais → processed;
5. chaves divergentes → rejected_permanent;
6. UUID malformado → rejected_permanent;
7. sessão desconhecida → failed_retryable;
8. empresa divergente → rejected_permanent;
9. tentativa já expired → idempotente;
10. subscription permanece inalterada;
11. duplicate event não cria segunda linha;
12. provider_session_id preservado.

Informar:

sql_transaction_test_started
sql_transaction_test_rolled_back
sql_test_count
sql_tests_passed
sql_tests_failed
test_rows_remaining
operational_state_match_before_after

7. REGRESSÃO

Executar novamente:

- 15 testes do handler;
- typecheck;
- build.

Confirmar:

handler_tests_discovered: 15
handler_tests_passed: 15
handler_tests_failed: 0
typescript_any_count: 0
typescript_double_assertion_count: 0
typecheck_status: pass
build_status: pass

8. ESTADO E PRESERVAÇÃO

Antes e depois da correção, informar:

payment_event_count_for_target_event
checkout_attempt_status
provider_session_id_present
f958_subscription_status
payment_executed
c610_changed
company_55bd_changed

operational_rows_manually_changed: 0
stripe_api_called: false
manual_redelivery_performed: false
frontend_publication_performed: false

homepage_git_blob:
30bbc2c591d4dfe7b7cfdb14ceee959a1fc25894

homepage_raw_sha256:
b4b1789dc02a9f0aaebe61f7dc94f111dad5d3c7bbf4bcfd6674d0287b221923

homepage_preserved: true

Se ocorrer tentativa AUTOMÁTICA da Stripe após a aplicação:

- não interferir;
- não reenviar;
- registrar separadamente o HTTP recebido e o estado remoto resultante.

DECISÃO:

Se a função for corrigida e os testes reais passarem:

final_decision = VEJAMAIS_STRIPE_CHECKOUT_EXPIRED_INTERNAL_SESSION_LINKAGE_CORRECTED
next_gate = VEJAMAIS_STRIPE_AUTOMATIC_EXPIRED_EVENT_DELIVERY_OBSERVATION

Se o teste SQL revelar nova divergência:

final_decision = VEJAMAIS_STRIPE_CHECKOUT_EXPIRED_RPC_CORRECTION_BLOCKED
next_gate = VEJAMAIS_STRIPE_RPC_EXACT_BRANCH_TARGETED_RECONCILIATION

PARAR. NÃO REENVIAR MANUALMENTE.

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
  component: LandingPage,
});
