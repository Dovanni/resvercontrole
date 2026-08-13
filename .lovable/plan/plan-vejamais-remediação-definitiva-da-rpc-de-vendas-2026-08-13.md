# Plan: VEJAMAIS — REMEDIAÇÃO DEFINITIVA DA RPC DE VENDAS

Este plano remove os bloqueios remanescentes na RPC de vendas, endurecendo a segurança e a integridade dos dados, além de realizar testes de concorrência real.

## User-facing changes
- Nenhuma alteração visível no fluxo nominal para o usuário.
- Maior confiabilidade contra duplicação de vendas e garantia de que toda venda comercial tenha itens vinculados.

## Technical details
- **Endurecimento da RPC**:
  - Tornar `p_idempotency_key` obrigatória (removendo o default NULL e validando formato/vazio).
  - Bloquear vendas sem itens (rejeitando arrays vazios ou nulos com o erro `VENDA_SEM_ITENS`).
  - Restringir privilégios de execução: apenas o papel `authenticated` terá acesso (revogando de `PUBLIC`, `anon` e `service_role`).
- **Gestão de Triggers**:
  - Auditoria via `pg_get_triggerdef` e garantia de que os efeitos colaterais (estoque, financeiro) ocorrem exatamente uma vez por transação.
- **Validação de Concorrência**:
  - Execução de teste com duas sessões simultâneas autenticadas para garantir que apenas uma venda seja persistida para a mesma chave de idempotência.
- **Matriz de Testes T01–T20**:
  - Execução individual e detalhada de todos os cenários, incluindo correções solicitadas para T05, T08, T15, T16 e T20.
- **Frontend**:
  - Verificação de que a chave de idempotência é estável e não é regenerada desnecessariamente.

## Operação Read-Only em Produção
- Todas as validações e testes serão realizados em blocos transacionais com `ROLLBACK` ou em ambiente de preview, sem afetar os dados reais da produção.
