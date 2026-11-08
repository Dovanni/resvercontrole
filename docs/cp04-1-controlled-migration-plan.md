# CP-04.1 — Plano de migration controlada (NÃO EXECUTAR)

## Estado
A função real `public.edit_payables_series_cp04(uuid,uuid,text,numeric,date,jsonb)` foi consultada no Supabase em modo SELECT, sem alteração de dados. A assinatura coincide com a proposta em `docs/cp04-production-rpc-review.sql`. A implementação real rejeita `recurrence='nenhuma'`.

## Procedimento após CI verde e autorização separada
1. Confirmar backup e identificar a função atual por `pg_get_functiondef`, preservando cópia para rollback.
2. Gerar um arquivo versionado usando `supabase migration new cp04_1_legacy_cadence` na estação local. NÃO aplicar ainda.
3. Transcrever o corpo revisado de `docs/cp04-production-rpc-review.sql` como `CREATE OR REPLACE FUNCTION` com a **mesma assinatura** e `SECURITY INVOKER`. Não executar o `BEGIN/COMMIT` de revisão como migração sem validação; manter grants atuais de `authenticated`, não conceder a `anon`/`PUBLIC`.
4. Revisar diff para garantir mudança mínima: permitir recorrência uniforme `nenhuma` e, somente nesse caso, calcular `p_anchor_due_date + (t.due_date - v_selected.due_date)`. As regras mensal e semanal permanecem intactas.
5. Testar a migration em PostgreSQL 17 descartável e, separadamente, validar Auth/JWT/RLS com Supabase local. Verificar pagamentos, cancelamentos, concorrência, integridade da série, escopo empresa/usuário, snapshot expirado.
6. Solicitar autorização explícita para aplicar a migration ao projeto `hoalgniwydgydqaugqph`; verificar assinatura, permissões e comportamento depois da aplicação.
7. Só após sucesso no banco, solicitar autorização de merge/deploy do frontend; validar em prévia antes de salvar lançamentos reais.

## Observação crítica
O snapshot atual da RPC contém id, amount, due_date, status, paid_amount e paid_at, mas **não recurrence**. Antes de autorizar a publicação, avaliar se mudança concorrente de recorrência precisa invalidar o snapshot; alinhar contrato entre frontend e RPC se necessário. Esta pendência é um gate, não um detalhe cosmético.

## Rollback
Em caso de falha, restaurar o `CREATE OR REPLACE FUNCTION` anterior preservado no backup de definição; nunca reverter lançamentos por UPDATE indiscriminado. Não iniciar rollback sem autorização.

## Proibições
Sem UPDATE direto em payables; sem reclassificar `nenhuma` como mensal; sem migration remota, merge ou deploy automático nesta fase.
