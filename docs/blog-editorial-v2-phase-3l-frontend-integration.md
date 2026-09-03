# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-L — Integração Repository-Only do Frontend com o Banco Editorial

Status: implementação repository-only. Sem deploy, sem merge em `main` e sem novas alterações no Supabase nesta fase.

## Objetivo

Introduzir uma fronteira explícita entre UI editorial e fonte de dados, mantendo o preview homologado estável enquanto o banco editorial permanece sem artigos importados.

## Arquitetura implementada

### `src/features/blog/blog.repository.ts`

A nova camada concentra dois contratos distintos:

1. **Preview local**
   - `listPreviewBlogArticles()`
   - `getPreviewBlogArticleBySlug()`
   - `getRelatedPreviewBlogArticles()`

   Estes métodos continuam usando `BLOG_ARTICLES`, onde os três conteúdos existentes permanecem `draft`.

2. **Supabase / banco editorial**
   - `listPublishedBlogArticles()`
   - `getPublishedBlogArticleBySlug()`
   - `getCurrentEditorialMember()`
   - `getEditorialDashboardSnapshot()`

   O adaptador público solicita apenas posts `published` com `published_at` já alcançado; a RLS do banco permanece a autoridade final de visibilidade.

### Mapper de banco → UI

`mapPublishedBlogPost()` transforma a estrutura relacional `blog_posts + categories + authors + tags` no contrato `BlogArticle` já homologado pelo Design Editorial V2.

O conteúdo JSONB é normalizado para `sections[]`, preservando o modelo atual de headings e paragraphs.

A imagem destacada, quando existir, é resolvida pelo bucket público `blog-media` através do cliente Supabase já usado pela aplicação.

## Rotas públicas

`/blog` e `/blog/$slug` deixaram de importar `BLOG_ARTICLES` diretamente. Agora passam exclusivamente pela abstração repository.

Nesta fase, essas rotas continuam usando a fonte **preview local**, deliberadamente. Isso evita que o Blog homologado fique vazio, pois nenhum dos três drafts foi importado para `blog_posts` ainda.

`noindex, nofollow, noarchive` continua preservado no preview.

## Área `/editorial`

Foi criada uma primeira shell editorial independente do `AppShell` multiempresa.

Comportamento:

- sessão ausente → tela de acesso protegido;
- sessão autenticada sem membership editorial → acesso negado;
- membership editorial ativo → dashboard somente leitura;
- resumo por status (`draft`, `review`, `scheduled`, `published`, `archived`);
- contagem de categorias, tags e autores;
- exibição do papel editorial e vínculo de autor;
- nenhuma ação de criar, editar, revisar, agendar ou publicar é oferecida.

A autorização é lida de `blog_editorial_members`; papéis `admin`, `vendedor` ou `financeiro` do ERP não são convertidos em papéis editoriais.

## Contratos preservados

- três artigos locais continuam `draft`;
- zero importações para `blog_posts`;
- zero publicações;
- zero alterações em Auth;
- zero alterações em membership editorial;
- zero migrations nesta fase;
- zero alterações Cloudflare;
- zero deploys;
- `main` permanece fora da execução.

## Testes

O contrato de testes foi expandido para cobrir:

- preview acessado via repository;
- resolução por slug;
- relacionados;
- metadados e conteúdo estruturado;
- transformação de row publicada para `BlogArticle`;
- rejeição de row não publicada pelo mapper público.

O workflow `Blog Editorial V2 Validation` continua responsável por executar os testes e o build completo após os commits desta fase.

## Próxima fronteira

Esta fase não ativa escrita editorial. A próxima evolução deverá tratar separadamente formulários, mutações e workflow de edição, sempre reutilizando RLS/triggers como autoridade do servidor e exigindo nova autorização antes de importar os drafts existentes ou disponibilizar publicação real.
