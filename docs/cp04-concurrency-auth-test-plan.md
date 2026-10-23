# CP-04 — plano executável de testes concorrentes e Supabase Auth

**Não concluído:** a RPC proposta em docs/cp04-production-rpc-review.sql não foi aplicada a um ambiente Supabase e não tem GRANT EXECUTE para authenticated.

## Concorrência — duas sessões independentes
1. Em um banco PostgreSQL efêmero com esquema compatível com public.payables, criar série fictícia e snapshot completo.
2. Sessão A: BEGIN; chamar RPC com valor 100; manter transação aberta após execução por 3 segundos; COMMIT.
3. Sessão B: iniciar chamada com snapshot original enquanto A mantém o bloqueio.
4. Confirmar que B espera os bloqueios, relê o estado atualizado, recebe erro de snapshot obsoleto e não altera registros.
5. Repetir com mudança de status para pago na sessão A; B deve falhar e não alterar parcela quitada.
6. Repetir com falha induzida no meio do lote; confirmar rollback integral e ausência de atualização parcial.
7. Registrar duração, SQLSTATE, IDs e valores anteriores/posteriores em logs de CI, sem dados reais.

## Supabase Auth real — laboratório separado
1. Criar instância Supabase local descartável, com Auth, PostgREST e políticas reais. Não reutilizar o projeto vejamais-erp-staging ou vejamais-blog-lab.
2. Aplicar **somente nessa instância** a migration revisada e a RPC com privilégios mínimos.
3. Criar dois usuários fictícios por Auth e duas empresas fictícias; usar tokens de usuário no cliente (nunca service_role).
4. Verificar acesso permitido do proprietário com vínculo à empresa, negado entre usuários e entre empresas, negado para anon.
5. Validar política SELECT e UPDATE e WITH CHECK, mudança de status concorrente e transação revertida.
6. Somente após aprovação habilitar GRANT EXECUTE para authenticated no laboratório e revalidar; produção exige autorização separada.

## Pendências de implementação antes do teste
- Reconciliar contrato da prévia do cliente com snapshot canônico de **todas** as linhas da série.
- Garantir verificação de vínculo do usuário à empresa no banco, não apenas empresa_id fornecido pelo cliente.
- Auditar RLS de public.payables e coluna paid_at para todas as políticas existentes.
- Criar séries novas com UUID de modo atômico, sem migrar automaticamente séries antigas por descrição.
- Adicionar execução real em duas conexões independentes ao CI e registrar resultados.
- Revisar SQL em PostgreSQL compatível antes de usar em qualquer banco.
- Adicionar confirmação explícita à interface **apenas depois** dos testes aprovados.

Nenhum desses itens pendentes deve ser interpretado como teste concluído.
