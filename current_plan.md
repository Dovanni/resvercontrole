# VEJAMAIS_STRIPE_CHECKOUT_ATTEMPT_TEST_LIVE_ISOLATION_CORRECTED_AND_PUBLISHED

## Objetivos
1. Introduzir `livemode` boolean em `checkout_attempts` para isolamento de ambiente.
2. Atualizar o índice de unicidade `idx_checkout_attempts_active_per_sub` para considerar o ambiente.
3. Corrigir a RPC `reserve_checkout_attempt` para gerenciar slots por ambiente.
4. Ajustar `billing.server.ts` para propagar o `livemode` correto (Live vs Sandbox).

## Mudanças Técnicas

### Banco de Dados (Migration SQL)
- Adição da coluna `livemode` BOOLEAN em `public.checkout_attempts`.
- Backfill seguro: `provider_checkout_session_id` LIKE 'cs_test_%' -> `livemode = false`, 'cs_live_%' -> `livemode = true`.
- Tornar `livemode` NOT NULL após backfill.
- Substituir `idx_checkout_attempts_active_per_sub` por `(empresa_id, subscription_id, livemode) WHERE status IN ('creating', 'open')`.
- Atualizar RPC `reserve_checkout_attempt` para aceitar `p_livemode` e filtrar por ele.

### Backend (TypeScript)
- `src/lib/billing.server.ts`:
  - Capturar `isProduction` via `getBillingEnvironment(host)`.
  - Passar `p_livemode: isProduction` para `reserve_checkout_attempt`.
  - Atualizar chamadas de idempotência e retomada para considerar o ambiente.

## Plano de Testes
- Validar se tentativa Sandbox aberta bloqueia nova Live (deve ser permitido).
- Validar se tentativa Live aberta bloqueia nova Live (deve ser bloqueado/reutilizado).
- Verificar se o `livemode` é derivado exclusivamente no servidor.
- Garantir que a integridade multiempresa e de assinatura permaneça intacta.

## Verificação de Segurança
- O `livemode` não é aceito do cliente (browser).
- RLS e GRANTs permanecem inalterados e restritos ao `service_role`.
