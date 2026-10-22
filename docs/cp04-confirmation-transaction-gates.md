# CP-04 — Gate de confirmação obrigatória e RPC de gravação

Status: **DESENHO PARA REVISÃO; SEM MIGRATION APLICADA, SEM RPC DE PRODUÇÃO**.

## Confirmação antes de gravar
1. Usuário escolhe escopo (single/future/all), valor individual e data âncora.
2. Servidor lê série persistida, confirma empresa/usuário e calcula lista de parcelas editáveis.
3. UI exibe total anterior, total novo, diferença e alterações de valor/data **por parcela**.
4. Usuário confirma expressamente; uma alteração nos campos invalida a confirmação.
5. Cliente envia expected_ids e snapshot dos valores/datas da prévia.
6. RPC SECURITY INVOKER, sob RLS, bloqueia toda a série em ordem determinística e **recalcula** os resultados; divergência aborta tudo.
7. Atualização única em transação, checagem da quantidade afetada e retorno dos IDs e totais; erro provoca rollback integral.

## Gates de segurança antes de habilitar
- RLS real: SELECT e UPDATE autorizados por user_id e empresa_id, membership server-side; sem bypass por service_role.
- Testar com Supabase Auth real em banco isolado, não apenas JWT simulado em PostgreSQL.
- Série sem UUID ou incompleta: bloqueada. Nunca inferir por sufixo textual.
- Parcelas pagas, canceladas, com paid_amount > 0 ou paid_at preenchido: intocadas.
- Checar conflito concorrente e mudança de estado entre prévia e confirmação.
- Validar regras de criação atômica de novas séries.
- Revisar SQL da migration e da RPC antes de aplicar, com autorização explícita.
- CI de build/typecheck da rota e integração ponta a ponta.
- **Até cumprir todos os gates, botões coletivos e execução RPC ficam desabilitados.**

## Estado atual
- O laboratório PostgreSQL executa atualização e rollback em esquema sintético, não em public.payables.
- RLS simulado valida isolamento de usuário e empresa; a primeira execução revelou erro de asserção no teste, corrigido em commit posterior.
- A UI tem prévia somente leitura condicionada a series_id, mas não habilita a gravação coletiva.
