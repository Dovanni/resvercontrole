# CP-04 — auditoria final de código (2026-10-22)

## Evidências
A rodada de CI no SHA `7ff0d4c1` terminou com **success** em:
- Concurrency + Supabase Auth GoTrue JWT: https://github.com/Dovanni/resvercontrole/actions/runs/39870041764
- Route build: https://github.com/Dovanni/resvercontrole/actions/runs/39870041995
- Preview unit tests: https://github.com/Dovanni/resvercontrole/actions/runs/39870041802
- PostgreSQL transactions: https://github.com/Dovanni/resvercontrole/actions/runs/39870041655

## Revisão de código
- RPC é SECURITY INVOKER, exige vínculo ativo e papel financeiro, trava parcelas e valida snapshot JSONB sob lock; status pago/cancelado e pagamento parcial excluídos.
- Regras semanais/mensais agora consistentes entre preview e SQL; fixtures têm recurrence.
- Colunas da migration são opcionais; dados legados não recebem identidade inferida pela descrição.
- Criação passou a persistir identidade UUID e índices de série; atualização individual condiciona status/paid_amount/paid_at no próprio UPDATE.
- Complemento de código SHA `3e39211`: impede criação de série sem recorrência suportada, fora de 2–120 parcelas, e mudança individual de cadência de série persistida. **CI deve ser repetido nesse novo SHA**.

## Riscos residuais que impedem GO imediato
1. **RLS direta de payables no banco real:** policy atual `own payables` autoriza por `user_id` apenas, não exige vínculo ativo/papel financeiro. A RPC restringe edição coletiva, mas INSERT/UPDATE/DELETE diretos ainda não possuem essa proteção. Exige decisão explícita sobre reforço de RLS e testes de regressão das operações financeiras existentes.
2. **Revogação simultânea:** vínculo é verificado com SELECT sem lock, por causa dos privilégios SELECT-only. Revogação concorrente com a transação pode ocorrer após verificação; testar ou implementar controle adequado.
3. **Equivalência visual de confirmação:** RPC verifica snapshot original, mas a prévia exibida pode ficar desatualizada entre releitura e confirmação; nesse caso RPC rejeita alterações financeiras concorrentes. Ainda faltam testes de ponta a ponta em interface com parcelas reais de laboratório.
4. **Plano de implantação:** schema deve existir antes do frontend; RPC depende das colunas; não executar deploy sem migração aprovada, backup, validação de GRANT/EXECUTE, checagem de policies, smoke tests e rollback.
5. **Mudança após CI:** novos commits exigem novo CI integral.

## Decisão
**NO-GO temporário para migration/merge/deploy**, até revisão de autorização para operações diretas e aprovação do CI final. Não aplicar migration nem conceder EXECUTE de RPC enquanto isso.

Nenhuma alteração no Supabase real, merge ou deploy foi feita nesta auditoria.
