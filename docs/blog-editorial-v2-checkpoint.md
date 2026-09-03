# Blog Editorial V2 — Checkpoint Repository-Only

Status: homologado em preview isolado
Branch: `feature/blog-editorial-v2`
Base auditada: `main` em `1c878ee6e59ba6c2ba80a191dabf711e7ff89067`

## Escopo consolidado

Este checkpoint mantém exclusivamente a implementação repository-only do Blog Editorial V2:

- conteúdo editorial local em `src/features/blog/articles.ts`;
- contratos editoriais e tipos em `src/features/blog/types.ts`;
- testes repository-only em `src/features/blog/blog.test.ts`;
- listagem em `src/routes/blog/index.tsx`;
- rota dinâmica de artigo em `src/routes/blog/$slug.tsx`;
- validação automatizada de testes + build em `.github/workflows/blog-editorial-v2-validation.yml`.

Nenhuma persistência externa, banco editorial, Supabase, Auth, billing, multiempresa ou deploy faz parte desta fase.

## Estado funcional homologado

A Fase 1-C validou em navegador Chromium real:

- carregamento de `/blog`;
- três cards editoriais;
- busca por texto;
- filtro por categoria;
- navegação por `Ler artigo`;
- carregamento direto de `/blog/$slug`;
- breadcrumb;
- canonical da listagem e do artigo;
- `robots: noindex, nofollow, noarchive`;
- JSON-LD `BlogPosting`;
- JSON-LD `BreadcrumbList`;
- CTA do VEJAMAIS ERP;
- slug inexistente retornando HTTP 404 e estado visual de artigo não encontrado;
- ausência de overflow horizontal em 390 px;
- ausência de erros de console antes do teste 404 deliberado.

## Evidência da auditoria

Workflow run final da auditoria visual/funcional: `33632320285`.
Resultado: `success`.
Artifact: `blog-editorial-v2-preview-audit`.
Digest informado pelo GitHub Actions: `sha256:83417a7049afe4e5c8f650eb3d72b269540df29bc4a96b2972e5505cc4bc6ff8`.

O workflow Chromium usado na Fase 1-C era deliberadamente temporário e foi removido após a homologação para não deixar infraestrutura diagnóstica pesada incorporada ao produto.

## Contratos de segurança do Preview V2

- Todos os artigos permanecem com status diferente de `published`.
- `getPublishedBlogArticles()` deve continuar retornando lista vazia nesta fase.
- As páginas públicas de preview permanecem com `noindex`.
- O conteúdo permanece local ao repositório.
- Não há leitura ou gravação de dados do ERP.
- Não há integração com Supabase.
- Não há deploy ou publicação implícita neste checkpoint.

## Arquivos fora do escopo

A consolidação não altera arquivos de autenticação, onboarding, multiempresa, billing/Stripe, banco, migrations, Edge Functions, Cloudflare ou configuração de produção.

## Próxima decisão permitida

A partir deste checkpoint, qualquer evolução deverá partir de uma decisão explícita entre:

1. continuar refinando conteúdo e apresentação repository-only; ou
2. projetar, em fase separada, banco editorial e painel administrativo.

Este documento registra estado e evidência; não autoriza merge, PR, deploy ou alteração de ambiente externo.
