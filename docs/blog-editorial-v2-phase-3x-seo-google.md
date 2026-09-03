# Fase 3-X — SEO Técnico e Integração Pública Google

Escopo: repository-only. Nenhum deploy, publicação, alteração Cloudflare, Search Console ou banco foi realizado nesta fase.

## Contrato público

- `/blog` passa a consumir exclusivamente `listPublishedBlogArticles()`.
- `/blog/$slug` passa a consumir exclusivamente `getPublishedBlogArticleBySlug()`.
- Ambos exigem `status = published` e `published_at <= now()`; RLS permanece uma segunda barreira independente.
- Drafts, conteúdos em review e scheduled não entram no read model público.

## SEO

- canonical em `https://vejamais.com.br/blog[/slug]`.
- robots `index, follow, max-image-preview:large` somente nas rotas públicas preparadas para conteúdo publicado.
- Open Graph e Twitter Card derivados do conteúdo publicado.
- `BlogPosting` JSON-LD com headline, description, datePublished, dateModified, author, publisher, mainEntityOfPage, keywords e imagem quando disponível.
- `BreadcrumbList` JSON-LD.
- helper de sitemap gera somente URLs recebidas do read model publicado.

## Estado atual

O staging possui zero posts `published`; portanto, mesmo após futuro deploy deste código, o read model público retornará zero artigos até uma publicação editorial explicitamente autorizada.

## Fora de escopo

- deploy;
- merge em main;
- mudança de DNS/Cloudflare;
- submissão de sitemap ao Google Search Console;
- criação/verificação de propriedade Search Console;
- publicação ou agendamento de artigos;
- alteração do workflow editorial.
