# CP-04 — auditoria somente leitura do esquema real (2026-10-22)

Projeto consultado: `vejamais-erp-staging` (`hoalgniwydgydqaugqph`). **Nenhuma instrução de escrita executada.**

## Evidência estrutural
- `public.payables`: `id uuid`, `user_id uuid NOT NULL`, `empresa_id uuid NOT NULL`, `amount numeric NOT NULL`, `due_date date NOT NULL`, `status text NOT NULL`, `paid_amount numeric NOT NULL DEFAULT 0`, `paid_at timestamptz`. **Não existem** `series_id`, `series_index`, `series_total`.
- `payables_status_check`: pendente, pago, atrasado, cancelado.
- RLS `own payables`: `ALL TO PUBLIC USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. Falta checagem de vínculo à empresa.
- Índice único legado `payables_unique_pendente`: `(user_id, description, due_date, amount)` para pendente/atrasado. A RPC deve capturar conflito de unicidade com rollback e erro inteligível.
- `public.user_company_access`: `user_id uuid`, `empresa_id uuid`, `role enum`, `status text`, `is_primary boolean`; SELECT RLS restringe `user_id=auth.uid()`.
- `public.empresas`: `id uuid`, `owner_id uuid`, `status text`; SELECT RLS permite proprietário ou `check_current_user_is_active_member(id)`.

## Decisão de segurança
Antes de qualquer migration ou GRANT:
1. RPC `SECURITY INVOKER` deve validar, **dentro da transação**, que `auth.uid()` possui vínculo ativo em `user_company_access` com `empresa_id` informada, e que a empresa está ativa. A autorização deve refletir papéis com permissão de edição financeira; identificar os valores reais do enum e as regras do módulo.
2. Rejeitar a operação se o vínculo estiver ausente, suspenso, ou empresa inativa; verificar RLS de `user_company_access` e `empresas`.
3. Corrigir o contrato de snapshot: comparação canônica deve incluir todas as parcelas da série, não apenas as alteradas; a interface deve solicitar confirmação explícita antes de invocar RPC.
4. Rever o algoritmo de calendário quando o escopo é `all` e a parcela selecionada não é a primeira: parcelas anteriores exigem offset mensal negativo; testar datas limites.
5. Garantir criação de `series_id/index/total` nas novas séries, sem inferir identidade das séries antigas por texto.
6. Em banco local com Supabase Auth verdadeiro, testar JWT emitido por GoTrue, dois usuários, empresas separadas, vínculo revogado, RLS, concorrência e rollback.
7. Gerar migration canônica pela CLI; validar adição de colunas e índices sem backfill destrutivo, medir locks e checar conflitos. Aprovação de escrita separada depois de todos os gates.

## Bloqueios
- Não há validação concluída com Supabase Auth real.
- RPC de revisão ainda não faz a verificação de `user_company_access` e status da empresa.
- O frontend ainda não invoca RPC com confirmação obrigatória.
- Não executar migration, merge ou deploy até fechar os bloqueios.
