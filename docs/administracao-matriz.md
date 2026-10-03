# Administração da Matriz

Rota `/administracao-matriz`, com link nos menus desktop/mobile exclusivamente após autorização do servidor. Primeira versão: consulta paginada de usuários Auth, empresas e registros de assinatura. Nenhuma ação de escrita, migration ou mudança de plano.

## Ativação pendente

Definir no ambiente do servidor `MATRIZ_ADMIN_USER_IDS` com UUIDs Auth dos operadores verificados da Matriz, separados por vírgula. Não utilizar e-mail, role de empresa, `empresas.tipo` ou metadados editáveis pelo usuário. Configuração ausente nega todo acesso. Esta implementação não altera configurações de produção nem concede acesso a usuário algum.

Reutiliza `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já usados no servidor. O cliente privilegiado é importado somente após validar a identidade atual e o UUID autorizado. Ambas as funções usam autenticação; a consulta revalida a autorização independentemente do menu. Não adicionar esses valores a variáveis `VITE_*`.

## Dados e limites

- 50 registros por página em cada lista; empresas e assinaturas ordenadas por cadastro decrescente. Usuários seguem a ordem fornecida pela API Auth.
- Contagens de empresas e assinaturas são totais exatos; usuários usam o total retornado pela API Auth quando disponível.
- Assinatura ativa não comprova pagamento. Exibir origem e último status de pagamento do ERP; não realizar chamadas Stripe ou reconciliar dados.
- Sem leitura de dados operacionais como vendas, estoque ou movimentações dos clientes. Sem retorno de tokens, metadados Auth completos ou IDs de pagamento Stripe.
- Não há ainda filtros, exportação, alteração de usuários, concessão de acesso, suspensão ou cancelamento.
- Antes de liberar: verificar UUIDs autorizados, confirmar ambiente Supabase e testar usuário Matriz, cliente admin e cliente comum. Uma chamada direta à consulta por cliente deve ser recusada.

## Validação

Teste unitário de autorização e build local. Validação autenticada real depende da configuração acima e deve ocorrer em fase separada, sem alterar usuários automaticamente.
