# VEJAMAIS ERP — LIVE Ready — Checkout Disabled

Checkpoint congelado em 2026-08-31 antes de qualquer ativação de cobrança LIVE.

## Código

- Branch operacional auditada: `migration/cloudflare-staging`
- Commit-base do código: `4547b7be6be95af3e144fa1a10c04821b6e9cea4`
- Commit: `test(stripe): lock sandbox/live credential boundaries`
- Workflow `Deploy Cloudflare Staging` #34: concluído com sucesso.

## Cloudflare Worker

- Worker: `resvercontrole`
- Versão ativa observada no runtime: `e29eee42-a743-442c-90cb-c912195cc3ff`
- Tráfego: 100%
- Runtime vars/bindings LIVE presentes:
  - `STRIPE_RESTRICTED_KEY_LIVE` — secret
  - `STRIPE_WEBHOOK_SECRET_LIVE` — secret
  - `STRIPE_PRICE_ENTERPRISE_MONTHLY_LIVE` — `price_1U2MGF2as7fOIzaqhqx3880R`
  - `STRIPE_LIVE_CHECKOUT_ENABLED` — `false`
- Credenciais TEST permanecem separadas.
- Nenhum valor secreto foi registrado neste checkpoint.

## Stripe LIVE

- Destino webhook ativo: `VEJAMAIS Preview — Assinaturas Stripe Live`
- Endpoint canônico: `https://vejamais.com.br/api/public/stripe-webhook/live`
- Eventos ouvidos: 7
- Nenhum checkout LIVE foi criado durante a preparação.
- Nenhuma cobrança real foi executada durante a preparação.

## Teste técnico não financeiro

Requisição manual sem `Stripe-Signature`:

- `POST https://vejamais.com.br/api/public/stripe-webhook/live`
- Resultado externo: `HTTP 401 Unauthorized`
- `trace_id` da aplicação: `743944cc-6c5b-461a-ac47-a9595195b9a4`
- Cloudflare Worker: `resvercontrole`
- Cloudflare scriptVersion: `e29eee42-a743-442c-90cb-c912195cc3ff`
- Resultado interno: `response.status = 401`, `outcome = ok`
- A requisição não continha `stripe-signature`.

Conclusão: o gate LIVE rejeita requisições não autenticadas antes de qualquer processamento de billing/RPC.

## Supabase

Projeto: `vejamais-erp-staging` (`hoalgniwydgydqaugqph`).

Migrations Stripe aplicadas e presentes no histórico:

- `20260831024457_close_stripe_billing_chain`
- `20260831024747_harden_stripe_trigger_privileges`
- `20260831124358_fix_stripe_invoice_subscription_resolution`

Auditoria somente leitura da janela do teste técnico (31/08/2026, 13:50–14:00 BRT):

- `public.checkout_attempts`: 0 registros criados/atualizados
- `public.subscriptions`: 0 registros criados/atualizados
- `public.stripe_webhook_runtime_diagnostics`: 0 registros

## Estado congelado

**LIVE Ready — Checkout Disabled**

Regra de segurança obrigatória até autorização futura explícita:

`STRIPE_LIVE_CHECKOUT_ENABLED=false`

Não alterar para `true` sem uma janela controlada de ativação e validação final.
