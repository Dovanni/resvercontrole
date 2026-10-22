# CP-04 — especificação SQL transacional (NÃO EXECUTAR)

> Documento de preparação e revisão; nenhum DDL ou DML foi aplicado ao Supabase.

## Constatações em leitura
- public.payables: id, user_id, empresa_id, supplier_id, description, category, amount, due_date, payment_method, bank_account_id, status, paid_amount, paid_at, recurrence; sem series_id.
- Índice único atual payables_unique_pendente em (user_id, description, due_date, amount) para pendente/atrasado, sem empresa_id. Revisar impacto separadamente; não modificar neste PR sem avaliação.
- A edição coletiva em loop no cliente não garante atomicidade.

## Proposta de migration aditiva (rascunho para revisão)
```sql
-- RASCUNHO: NÃO EXECUTAR
ALTER TABLE public.payables
  ADD COLUMN series_id uuid,
  ADD COLUMN series_index integer,
  ADD COLUMN series_total integer;
ALTER TABLE public.payables
  ADD CONSTRAINT payables_series_fields_consistent CHECK (
    (series_id IS NULL AND series_index IS NULL AND series_total IS NULL)
    OR (series_id IS NOT NULL AND series_index IS NOT NULL AND series_total IS NOT NULL
        AND series_total BETWEEN 2 AND 120
        AND series_index BETWEEN 1 AND series_total)
  );
CREATE UNIQUE INDEX payables_series_position_unique
  ON public.payables (empresa_id, series_id, series_index)
  WHERE series_id IS NOT NULL;
CREATE INDEX payables_series_lookup
  ON public.payables (empresa_id, user_id, series_id)
  WHERE series_id IS NOT NULL;
```

## Contrato da RPC planejada (ainda NÃO implementada)
`edit_payables_series(p_empresa_id uuid, p_payable_id uuid, p_scope text, p_patch jsonb, p_expected_ids uuid[])`
- SECURITY INVOKER, search_path explícito, EXECUTE apenas authenticated; checar auth.uid() e RLS, empresa_id e user_id.
- Pegar series_id do registro selecionado, bloquear todas as linhas da série com SELECT ... FOR UPDATE, ordenar deterministicamente por id para reduzir deadlock.
- Recusar série incompleta, índices duplicados, alterações em série de terceiros, inconsistências de propriedade ou status, divergência com p_expected_ids.
- Escopos single/future/all; incluir apenas pendente/atrasado. Parcialmente quitadas: bloquear por padrão.
- Campos permitidos: descrição-base, categoria, fornecedor, valor por parcela, método, conta bancária, vencimento conforme regra aprovada; nunca status, paid_amount, paid_at, empresa_id, user_id, series_id.
- Validar fornecedor/conta bancária dentro da mesma empresa e usuário.
- Atualizar em uma única transação PostgreSQL; se qualquer validação/constraint falhar, RAISE EXCEPTION para rollback integral.
- Auditar operador, IDs afetados, campos antigos/novos e timestamp (esquema de auditoria a definir).
- Responder contagem, IDs, e versão da série para confirmação e concorrência.
- Atenção: não basta confiar em lista `all` filtrada pela tela; a RPC consulta a tabela.

## Fluxo de gravação de novas séries
- Gerar UUID por lançamento coletivo e gravar series_id/index/total em todas as parcelas.
- A criação de série também precisa ser atômica; avaliar RPC dedicada para criar a série.
- Legado sem series_id: NÃO atribuir por descrição. Conciliação manual separada, aprovada, auditável.

## Testes (planejados, NÃO executados)
1. Single altera só uma linha; future altera índices >= selecionado; all altera todas as pendentes.
2. Pagas, canceladas e parcialmente liquidadas não são alteradas.
3. Séries com descrições iguais e empresas distintas permanecem isoladas.
4. Falha na última parcela provoca rollback de todas.
5. Concorrência com duas sessões não causa atualização perdida.
6. Validação de RLS, proprietário, fornecedor e conta bancária.
7. Série legada ou incompleta falha de modo seguro.
8. Datas 29/30/31, fevereiro e ano bissexto; regra de reajuste de valor explicitada.
9. CI build/typecheck, integração em banco descartável e revisão do SQL.

## Gates
- Aprovar regra de negócio: valor individual vs redistribuição total; alteração de vencimento por deslocamento ou calendário.
- Auditar RLS e políticas em detalhes antes de definir a função.
- Criar migration por CLI em branch após aprovação; nunca executar em produção sem autorização específica.
- Não mergear PR #38 nem publicar Worker antes de CI e testes de integração.
