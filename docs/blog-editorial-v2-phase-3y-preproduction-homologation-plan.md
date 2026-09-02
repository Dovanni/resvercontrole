# Fase 3-Y — Homologação Pré-Produção e Plano de Implantação

## Objetivo

Consolidar um plano executável e fail-safe para levar o Blog Editorial V2 da branch `feature/blog-editorial-v2` até produção, sem realizar nesta fase merge em `main`, deploy, publicação de artigos, alteração de Cloudflare/DNS, Search Console ou qualquer escrita adicional no Supabase.

## Veredito da homologação pré-produção

**APROVADO CONDICIONALMENTE PARA PREPARAÇÃO DE IMPLANTAÇÃO.**

O código, o route tree, os contratos editoriais e o staging estão tecnicamente coerentes. A autorização de deploy continua bloqueada até resolução explícita dos gates de ambiente e descoberta pública descritos abaixo.

## Baseline de aplicação

- Build oficial: `npm run build` (`vite build`).
- Runtime: TanStack Start com entry customizado `src/server.ts`.
- Target gerado pelo build validado: Nitro/Cloudflare module.
- CI da branch: testes do Blog Editorial V2 + build completo + guard de sincronismo de `src/routeTree.gen.ts`.
- Route tree oficial já consolidado para `/blog`, `/blog/$slug`, `/editorial`, `/editorial/editor` e `/sitemap-blog.xml`.

## Baseline de staging — somente leitura

Projeto confirmado: `vejamais-erp-staging` (`hoalgniwydgydqaugqph`).

Migrations editoriais registradas:

1. `20260902172726_blog_editorial_v2_schema`
2. `20260902172742_blog_editorial_v2_post_lab_hardening`
3. `20260902212123_blog_editorial_v2_draft_transaction_rpc`
4. `20260902212140_blog_editorial_v2_draft_rpc_qualification_fix`

Estado estrutural observado:

- 9 tabelas `blog_*`;
- 9/9 com RLS habilitado;
- 35 policies Blog/Storage;
- bucket `blog-media` presente;
- 2 memberships editoriais ativas;
- 3 posts totais;
- 2 `draft`;
- 1 `review`;
- 0 `scheduled`;
- 0 `published`;
- 0 publicamente elegíveis.

Nenhum dado foi alterado durante esta homologação.

## Contrato público do Blog

A rota `/blog` consulta exclusivamente `listPublishedBlogArticles()`. O repositório filtra `status = published` e `published_at <= now()`, além da proteção independente por RLS. Portanto, com o estado atual do staging, a página pública deve permanecer vazia de artigos reais.

A rota `/blog/$slug` usa o mesmo gate de publicação e retorna 404 quando o slug não é publicamente elegível.

`/sitemap-blog.xml` também deriva exclusivamente do read model publicado. Em falha de leitura, responde fail-closed com HTTP 503; em sucesso, responde XML e não altera os sitemaps históricos.

A área `/editorial` é marcada `noindex, nofollow, noarchive` e exige sessão autenticada + membership editorial ativo antes de carregar o read model administrativo.

## Gate Y-1 — Destino Supabase de produção

A conexão Supabase disponível nesta auditoria lista somente:

- `vejamais-erp-staging`;
- `vejamais-blog-lab`.

Nenhum terceiro projeto foi assumido como produção. Antes do deploy público deve ser confirmado, por evidência objetiva, qual Supabase URL/publishable key o ambiente Cloudflare de `vejamais.com.br` utiliza.

**Regra:** não executar migrations, bootstrap, importação ou publicação em qualquer projeto enquanto o alvo de produção não estiver inequivocamente identificado.

## Gate Y-2 — Descoberta do Blog pela landing page

A landing page atual não contém item `Blog` no array de navegação principal. Assim, embora `/blog` esteja roteado, ele não é hoje uma entrada explícita do menu principal da home.

Antes do go-live deve haver uma decisão explícita entre:

- incluir `Blog` no header e, idealmente, no footer da landing page; ou
- lançar inicialmente por URL/sitemap sem navegação principal, se essa for uma escolha editorial deliberada.

A recomendação para lançamento público é incluir `Blog` na navegação, em alteração pequena e isolada, validada em desktop e mobile antes do deploy.

## Gate Y-3 — Conteúdo inicial

Nenhum artigo está publicado. O lançamento da infraestrutura pode ocorrer com Blog vazio, mas indexação/descoberta pública só produz valor editorial após uma autorização separada para publicar pelo menos um artigo aprovado.

Publicação de artigo deve continuar respeitando four-eyes, revisão corrente aprovada, `published_at` válido e executor fail-closed. Esta fase não autoriza mudança de status.

## Gate Y-4 — robots.txt e Search Console

O `robots.txt` vivo permanece gerenciado pelo Cloudflare, permite crawling geral e não contém `Sitemap:`. Não criar nem substituir `robots.txt` no repositório.

Após o deploy e somente após o endpoint `/sitemap-blog.xml` estar validado publicamente, uma futura alteração pode acrescentar `Sitemap: https://vejamais.com.br/sitemap-blog.xml` na configuração que atualmente produz o robots gerenciado, preservando todas as regras existentes.

Submissão do sitemap ao Google Search Console é uma ação posterior e independente, também sujeita a autorização específica.

## Sequência controlada de implantação

### Etapa A — Pré-merge

1. CI final da branch verde.
2. `git diff --exit-code -- src/routeTree.gen.ts` verde após build.
3. Comparação branch → `main` sem commits de `main` ausentes.
4. Revisão final do diff para excluir mudanças fora do Blog Editorial V2 e documentação/CI associada.
5. Confirmar destino Supabase real do ambiente público.
6. Decidir e homologar a entrada `Blog` na landing page.

### Etapa B — Integração

1. Abrir Pull Request `feature/blog-editorial-v2` → `main`.
2. Não usar push direto em `main`.
3. Aguardar checks obrigatórios e revisão humana.
4. Registrar SHA exato do merge como baseline de produção.

### Etapa C — Banco de produção, somente se aplicável

Antes de qualquer DDL, comparar migrations já registradas no destino real com as quatro migrations editoriais da branch.

- Se já presentes e equivalentes: não reaplicar.
- Se ausentes: gerar plano de aplicação ordenada e rollback, auditar o SQL novamente e solicitar autorização específica.
- Nunca copiar dados ou memberships do staging automaticamente para produção.

### Etapa D — Deploy da aplicação

1. Fixar o SHA de `main` aprovado.
2. Executar build idêntico ao CI.
3. Publicar apenas o artefato derivado desse SHA.
4. Não alterar DNS, robots, Search Console ou estado editorial durante o mesmo change window.

### Etapa E — Smoke tests imediatamente pós-deploy

Executar em ordem:

1. `/` → HTTP 200 e landing visualmente íntegra.
2. `/login` e `/cadastro` → carregam sem regressão.
3. uma rota autenticada crítica → sessão/menu preservados.
4. `/blog` → HTTP 200, shell editorial íntegro e somente artigos elegíveis.
5. `/blog/<slug-publicado>` → somente quando houver artigo publicado; HTTP 200, canonical/metadata e conteúdo corretos.
6. `/blog/slug-inexistente` → 404 editorial.
7. `/editorial` sem login → acesso protegido, sem vazamento de dados.
8. `/editorial` com usuário não membro → acesso negado.
9. `/editorial` com membership autorizado → painel carrega conforme RLS.
10. `/sitemap-blog.xml` → HTTP 200 XML quando o backend estiver saudável; somente URLs publicadas.
11. `robots.txt` → conteúdo Cloudflare preservado, sem substituição acidental.
12. Auth/onboarding, multiempresa e billing → smoke regressivo mínimo porque são domínios críticos da matriz e não podem mudar por efeito colateral do Blog.

## Critérios de NO-GO

Interromper a implantação se ocorrer qualquer um dos seguintes:

- destino Supabase do domínio público não confirmado;
- CI vermelho;
- route tree divergente depois do build;
- branch atrás de `main` no momento do merge;
- diff inesperado em Auth, onboarding, multiempresa, billing ou outras áreas da matriz;
- migrations editoriais divergentes no destino;
- RLS/policies ausentes ou menos restritivas do que o staging homologado;
- `/blog` expondo draft/review/scheduled futuro;
- `/editorial` acessível sem membership;
- regressão em landing, login ou fluxo autenticado;
- necessidade de alterar robots/DNS para fazer o deploy básico funcionar.

## Rollback

### Aplicação

Rollback primário: redeploy do último SHA de produção conhecido como saudável ou revert do merge do Blog em `main`, preservando banco e conteúdo editorial.

### Banco

DDL editorial não deve ser revertido automaticamente junto com o frontend. Qualquer rollback de schema deve usar os scripts de rollback versionados e nova autorização, depois de verificar dependências e dados existentes.

### Conteúdo

Se um artigo publicado apresentar problema, a contenção editorial deve seguir o workflow autorizado (por exemplo, arquivamento/retirada conforme contrato), nunca DELETE ad hoc.

### SEO/Cloudflare

Se uma futura mudança de robots/Search Console causar problema, revertê-la separadamente sem acoplar ao rollback da aplicação.

## Janela de observação pós-deploy

Antes de qualquer ação de SEO adicional ou publicação em lote:

- confirmar ausência de erros 5xx novos;
- confirmar `/blog` e sitemap estáveis;
- confirmar login/onboarding/multiempresa/billing sem regressões aparentes;
- confirmar que somente conteúdo `published` elegível é público;
- preservar evidência do SHA implantado e dos smoke tests.

## Estado ao fechar a Fase 3-Y

- homologação pré-produção: concluída;
- plano de implantação: concluído;
- staging editorial: íntegro em leitura;
- produção Supabase inequivocamente identificada: **pendente**;
- decisão de link `Blog` na landing: **pendente**;
- CI final desta documentação: deve permanecer verde;
- PR para `main`: não aberto nesta fase;
- merge: não;
- deploy: não;
- Cloudflare/DNS: não alterado;
- Search Console: não alterado;
- artigos publicados: 0.

## Próxima autorização recomendada

**Fase 3-Y.1 — Fechamento dos Gates de Go-Live**, limitada a:

1. identificar por evidência o Supabase efetivamente usado por `vejamais.com.br`;
2. definir/homologar a entrada `Blog` na navegação pública;
3. executar comparação final da branch com `main` e produzir o manifesto exato do PR/deploy;
4. manter merge, deploy, migrations de produção e publicação ainda bloqueados até autorização posterior explícita.
