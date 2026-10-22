# CP-04 — revisão final pré-migration (2026-10-22)

**Decisão: NO-GO para migration + merge + deploy neste momento.** Consultas do projeto `vejamais-erp-staging` somente leitura; não houve alteração de registros.

## Evidências dos jobs (todos encerrados com success)
- GitHub Actions 39863719552: `concurrency` e `real_supabase_auth`.
- GitHub Actions 39863719708: `build`.
- GitHub Actions 39863719748: `preview-tests`.
- GitHub Actions 39863719537: `transactional-tests`.

## Compatibilidade da migration com esquema real
- `public.payables` tem `empresa_id uuid NOT NULL`, `user_id uuid NOT NULL`, `amount numeric NOT NULL`, `due_date date NOT NULL`, `paid_amount numeric NOT NULL DEFAULT 0`, `paid_at timestamptz`; ainda não possui `series_id`, `series_index`, `series_total`.
- Adição das três colunas anuláveis e CHECK triplo preserva dados legados sem backfill. Índices propostos não conflitam por nome com os índices atuais.
- Índice único legado `payables_unique_pendente` é `(user_id,description,due_date,amount)` com status pendente/atrasado. Pode impedir algumas reprogramações; a transação deve reverter tudo.
- RLS atual de `payables` restringe `user_id`, não `empresa_id`; RPC contém vínculo ativo com papel financeiro, mas operações diretas na tabela ainda não têm o mesmo requisito.

## Bloqueios objetivos
1. **Criação de novas séries não integrada.** `PayableForm` ainda insere parcelas sem `series_id/index/total`. Aplicar apenas a migration não habilitará a edição coletiva; integração deve ser implantada somente após disponibilidade do esquema.
2. **Recorrência semanal.** O formulário permite `semanal` e `mensal`, mas a RPC usa apenas calendário mensal; a série deve persistir sua cadência e a RPC deve suportá-la ou rejeitar explicitamente séries semanais. Sem isso, risco de datas incorretas.
3. **Edição individual com TOCTOU.** A rota verifica status com SELECT e depois UPDATE sem predicados `status IN ('pendente','atrasado')`, `paid_amount=0`, `paid_at IS NULL`; uma quitação concorrente entre consultas pode ser sobrescrita.
4. **Snapshot JS ↔ PostgreSQL.** `paid_at` em timestamptz retorna representação ISO; a comparação jsonb exige equivalência de strings de timestamp. Teste real atual usa valores `paid_at=null` nas séries; faltam casos com timestamps não nulos e frações/offsets. Garantir serialização idêntica.
5. **Escopo all com índice selecionado >1.** Confirmar calendário com offsets negativos e datas de fim de mês na RPC real; unit tests TS não substituem teste SQL.
6. **Confirmação no frontend.** Releitura antes do diálogo e snapshot gerado dessa releitura. O snapshot é invalidado se algo mudar antes do lock da RPC, mas não há garantia de que a confirmação visual corresponde ao instante da gravação sem o gate transacional. Conferir retorno divergente pós-RPC não reverte a transação já confirmada.
7. **Migration operacional.** Criar arquivo canônico via Supabase CLI, checar locks/tempo em tabela real, advisors, plano de rollback, pré-check de índices e backup, e aprovação específica antes de aplicar.

## Plano de fechamento
- Separar schema, criação de séries e habilitação RPC em gates de rollout controlado.
- Especificar cadência de cada série sem inferir descrição legada.
- Testar timestamps pagos no snapshot com JWT real, e calendário semanal/mensal em SQL.
- Corrigir atualização individual para condição atômica de status; provar teste de corrida.
- Reexecutar CI, revisão do diff, aprovação da migration e somente então promover PR/merge/deploy.

**Proibição mantida:** nenhuma migration, GRANT, merge ou deploy sem fechar bloqueios e obter autorização de execução.
