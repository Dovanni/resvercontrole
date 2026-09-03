# Fase 3-X.2D — Consolidação Pré-Deploy Repository-Only

Escopo: repository-only. Nenhum deploy, merge para `main`, alteração em Cloudflare/DNS/Search Console, publicação de artigo ou alteração do staging foi executado nesta fase.

## Checkpoint consolidado

- Branch: `feature/blog-editorial-v2`
- HEAD auditado antes deste documento: `7dfafe75fc95331eec8649f5d7216412e95f57a3`
- Base `main`: `1c878ee6e59ba6c2ba80a191dabf711e7ff89067`
- Relação com `main`: 99 commits à frente, 0 atrás
- CI do HEAD auditado: `Blog Editorial V2 Validation` run `33692302520` concluído com `success`

## Escopo do diff contra main

O comparativo `main...feature/blog-editorial-v2` contém exclusivamente artefatos do Blog Editorial V2 e seu processo de validação:

- `.github/workflows/blog-editorial-v2-validation.yml`
- documentação `docs/blog-editorial-v2-*`
- componentes `src/components/blog/*`
- domínio e adaptadores `src/features/blog/*`
- rotas públicas `/blog`, `/blog/$slug` e `/sitemap-blog.xml`
- rotas administrativas editoriais `/editorial*`
- migrations, bootstrap manual e rollbacks `supabase/*blog_editorial_v2*`

Não foram identificadas modificações no comparativo em módulos operacionais existentes de vendas, compras, estoque, financeiro, multiempresa, onboarding, billing/Stripe ou Cloudflare.

## Sitemap editorial

A rota `src/routes/sitemap-blog[.]xml.tsx` permanece isolada do sitemap histórico. Ela consome somente `listPublishedBlogArticles()` e falha fechada com HTTP 503 quando o read model não puder ser carregado.

No estado validado do staging havia 3 posts totais, sendo 2 `draft`, 1 `review`, 0 `scheduled`, 0 `published` e 0 publicamente elegíveis. Portanto nenhum artigo atual entra no sitemap editorial.

## CI/build

A validação executável anterior confirmou:

- 79/79 testes do Blog aprovados;
- build client concluído;
- build SSR concluído;
- build Nitro/Cloudflare concluído;
- nenhuma falha introduzida pela rota de sitemap.

Warnings de depreciação/chunk já observados no build não foram tratados nesta fase por não pertencerem ao escopo do Blog.

## Pendência 1 — routeTree.gen.ts

O arquivo versionado `src/routeTree.gen.ts` está atrasado em relação às rotas introduzidas pela branch. O próprio arquivo declara ser gerado automaticamente e não deve ser editado manualmente.

O TanStack Router o regenera durante testes/build, razão pela qual o CI está verde. A consolidação pré-deploy exige que esse arquivo seja regenerado pelo mecanismo oficial do projeto e o resultado versionado antes de merge/deploy, sem edição manual.

Enquanto isso não ocorrer, o pacote é tecnicamente validado pelo build, porém ainda não é considerado `merge-ready`.

## Pendência 2 — robots.txt vivo

Nenhum `robots.txt` foi criado ou substituído nesta branch. O repositório não contém a origem histórica do arquivo atualmente servido no domínio e a leitura pública confiável do conteúdo vivo ainda não foi obtida.

A única mudança futura admissível deve preservar integralmente o conteúdo real existente e acrescentar, se ainda ausente:

`Sitemap: https://vejamais.com.br/sitemap-blog.xml`

Nenhuma alteração deve ser realizada até o conteúdo vivo ser auditado.

## Estado pré-deploy

- banco editorial no staging: implantado e isolado;
- owner editorial: ativo;
- reviewer independente: ativo;
- four-eyes real: validado;
- 3 drafts importados: presentes;
- artigo-piloto: `review` com decisão `approved`, ainda não publicado;
- artigos `published`: 0;
- read model público: published-only;
- canonical/Open Graph/Twitter/BlogPosting/Breadcrumbs: implementados;
- `/sitemap-blog.xml`: implementado repository-only;
- sitemap histórico: não alterado;
- `robots.txt`: não alterado;
- Search Console: não alterado;
- Cloudflare/DNS: não alterado;
- deploy: não executado.

## Critérios para a próxima fase

Antes de qualquer autorização de deploy devem ser concluídos, no mínimo:

1. regeneração oficial e revisão de `src/routeTree.gen.ts`;
2. leitura/reconciliação somente leitura do `robots.txt` vivo;
3. CI verde sobre o checkpoint final consolidado;
4. auditoria final do diff contra `main`;
5. autorização explícita e separada para merge/deploy;
6. publicação editorial deve permanecer uma autorização separada do deploy técnico.
