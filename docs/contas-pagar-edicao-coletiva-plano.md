# Edição coletiva — critérios de segurança PR #38

## Diagnóstico confirmado
- Tabela payables sem identificador de série; descrição (1/17) não é identidade segura.
- Atualização em loop no cliente não é atômica.
- Branch Draft mantém opções coletivas desabilitadas e bloqueio no salvamento.
- Nenhuma migration ou alteração de dados executada.

## Proposta sujeita a aprovação
1. Migration aditiva: series_id UUID opcional, series_index e series_total; unicidade por empresa + série + índice.
2. Gravação de novas séries com UUID persistido. Legado sem série permanece individual até conciliação explícita.
3. RPC transacional, preferencialmente SECURITY INVOKER, com autenticação, RLS, autorização de empresa, lock de linhas e rollback integral.
4. Preservar pagamentos, cancelamentos, valores já liquidados e isolamento multiempresa.
5. Definir política de valores e vencimentos antes de habilitar UI; confirmar impacto antes da gravação.

## Testes obrigatórios (ainda não executados)
- Individual / futuras pendentes / todas pendentes.
- Pagas, canceladas e parcialmente quitadas imutáveis.
- Séries homônimas não se misturam; séries incompletas e legado bloqueados.
- Outra empresa ou usuário: acesso negado.
- Erro intermediário: zero atualizações após rollback.
- Concorrência, índice duplicado, fevereiro, dias 29-31 e anos bissextos.
- CI: typecheck, build, testes unitários e integração em banco isolado.

## Gate
Não efetuar merge/deploy nem migration sem revisão, testes documentados e autorização específica.