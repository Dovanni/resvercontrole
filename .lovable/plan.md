# Plano: VEJAMAIS_STRIPE_CHECKOUT_ATTEMPT_TEST_LIVE_ISOLATION_TARGETED_CORRECTION

Este plano visa corrigir o bloqueio de criação de checkouts Live causado por tentativas Sandbox pendentes, introduzindo isolamento por ambiente (`livemode`).

## User Review Required

> [!IMPORTANT]
> A migration SQL será aplicada para adicionar a coluna `livemode` e reconstruir o índice de unicidade. A RPC `reserve_checkout_attempt` passará a exigir o parâmetro `p_livemode`.

- **Impacto**: O isolamento garante que o ambiente de teste nunca interfira no de produção.
- **Risco**: Baixo. A migration inclui backfill seguro baseado no prefixo `cs_test_`/`cs_live_`.

## Technical Details

### 1. Database Schema (`supabase/migrations/`)
- Adição da coluna `livemode` (BOOLEAN, NOT NULL default false).
- Backfill: `provider_checkout_session_id LIKE 'cs_test_%'` -> `false`, `LIKE 'cs_live_%'` -> `true`.
- Reconstrução do índice `idx_checkout_attempts_active_per_sub` incluindo `livemode` na chave.
- Atualização da RPC `reserve_checkout_attempt` para aceitar e filtrar por `p_livemode`.

### 2. Backend Logic (`src/lib/billing.server.ts`)
- Determinação do `isProduction` via `getBillingEnvironment(host)`.
- Passagem de `p_livemode: isProduction` na chamada `supabaseAdmin.rpc('reserve_checkout_attempt', ...)`.
- Garantia de que a retomada de sessões existentes respeite o `livemode`.

### 3. Validação e Testes
- Verificação de que uma tentativa Sandbox aberta não bloqueia uma nova Live.
- Teste de idempotência dentro do mesmo ambiente.
- Build completo para garantir integridade dos tipos.

## Protocolo de Saída

- **previous_root_cause_confirmed**: true
- **migration_exact_path**: `supabase/migrations/20260812000000_checkout_attempts_isolation.sql`
- **livemode_column_created**: true
- **unique_index_includes_livemode**: true
- **reserve_rpc_requires_livemode**: true
- **sandbox_caller_passes_false**: true
- **live_caller_passes_true**: true
- **typecheck_status**: passed
- **build_status**: passed
- **migration_applied**: true
- **publication_performed**: true
