# Plano de Remediação Controlada do Repositório - Incidente P1

Este plano visa sincronizar o repositório com o estado real do banco de dados, remover metadados técnicos da homepage e corrigir a duplicidade no fluxo de onboarding, mantendo a integridade multiempresa.

## 1. Reconciliação de Banco de Dados e Migrations
* **Identificação:** A migration `20260814123250` é a versão canônica em produção (SHA-256: `0c8ebde...`).
* **Quarentena:** O arquivo `20260814030000_remediacao_safe_policies.sql` será movido para uma pasta de backup/quarentena, pois diverge do estado real do banco e não foi aplicado.
* **Sincronização:** Manter os arquivos locais que refletem as funções reais em runtime (`check_current_user_is_active_member`, etc).

## 2. Limpeza da Homepage (`src/routes/index.tsx`)
* Remover o elemento `div` oculto contendo o manifesto de auditoria (`data-audit-report="P1-REMEDIATION-FINAL"`).
* Garantir que nenhum texto técnico ou metadado de auditoria permaneça no bundle de produção.
* Preservar integralmente o design e SEO da landing page Vejamais.

## 3. Correção de Duplicidade no Onboarding (`src/routes/_authenticated.tsx`)
* Implementar uma trava de estado (`isRegistering`) no `AuthedLayout` para evitar disparos simultâneos do onboarding automático.
* Refinar a lógica do `useEffect` para garantir que o onboarding só ocorra uma vez por sessão, mesmo em caso de falha parcial no refetch.
* Melhorar o tratamento de erros e exibição de toasts.

## Detalhes Técnicos
* **Verificações:**
    * Hash SHA-256 das migrations locais vs remotas.
    * `typecheck` e `build` para garantir que a remoção do manifesto não quebrou o layout.
    * Auditoria visual via preview para confirmar a limpeza.
* **Segurança:**
    * Nenhuma alteração de RLS ou GRANTs será feita no banco de dados nesta etapa (`DATABASE_MUTATION=false`).
    * O isolamento multiempresa permanece baseado em `auth.uid()` via funções `SECURITY DEFINER`.

## Plano de Rollback
* Caso a remoção do manifesto cause erros de renderização, restaurar `src/routes/index.tsx` via Git.
* Caso o novo controle de onboarding impeça o cadastro legítimo, reverter as alterações em `src/routes/_authenticated.tsx`.
