# CP-04.1 — diagnóstico e contrato de segurança para séries históricas

Status: investigação somente leitura; **não pronto para merge/deploy**.

## Evidência do caso (consulta SELECT, 2026-11-08)
Série identificada pelo sufixo de descrição `(1/4)`, vinculada com `series_id`, quatro linhas pendentes, `paid_amount=0`, `paid_at IS NULL`. Recorrência persistida de todas: `nenhuma`. Vencimentos: 2026-12-13, 2027-01-03, 2027-02-03, 2027-03-03.

## Causa
`src/lib/payables-collective-preview.ts` rejeita qualquer série cuja `recurrence` não seja `mensal` ou `semanal`. A função de banco `public.edit_payables_series_cp04` também rejeita essa condição. Alterar apenas o frontend não resolve.

## Regras obrigatórias antes da implementação
1. Não converter automaticamente `nenhuma` para `mensal`: os vencimentos não têm cadência uniforme.
2. Não executar UPDATE de `recurrence`, `due_date`, `amount` ou `series_id` para corrigir o cadastro histórico.
3. Definir contrato explícito de reagendamento de série legada: preservar os deslocamentos originais entre vencimentos **ou** solicitar escolha explícita da periodicidade ao usuário; a prévia e a RPC devem implementar exatamente a mesma regra. Não inferir periodicidade silenciosamente.
4. O banco deve validar integralidade da série, tenant/usuário, índices, status, pagamento parcial, snapshot sob lock e concorrência; jamais atualizar parcelas pagas/canceladas/parcialmente pagas.
5. Implementar a mudança na RPC via migration versionada e testar em PostgreSQL isolado antes de pedir autorização de aplicação ao projeto Supabase.
6. Adicionar testes de regressão para série legada `nenhuma`, datas irregulares, semanal, mensal, mista, parcelas liquidadas, snapshot desatualizado e acesso entre empresas.

## Bloqueio atual
A correção de interface isolada seria insegura porque a RPC de produção continuaria rejeitando a série. Este documento não autoriza alterações de produção.
