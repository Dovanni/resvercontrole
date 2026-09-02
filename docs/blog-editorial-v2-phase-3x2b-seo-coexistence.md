# Fase 3-X.2B — Convivência SEO e sitemap-blog.xml

Escopo: repository-only. Nenhum deploy, alteração de Search Console, Cloudflare, DNS, robots.txt publicado ou publicação de artigo foi realizado.

## Objetivo

Introduzir um sitemap editorial isolado em `/sitemap-blog.xml`, sem substituir os sitemaps históricos já conhecidos pelo Google Search Console.

## Implementação

- Nova rota server-side `src/routes/sitemap-blog[.]xml.tsx`.
- A rota consulta exclusivamente `listPublishedBlogArticles()`.
- O read model já exige `status = published` e `published_at <= now()` e continua protegido por RLS.
- O XML é produzido por `buildBlogSitemapXml()`.
- Em sucesso responde `application/xml`, cache curto e `X-Robots-Tag: noindex` para o próprio arquivo de sitemap.
- Em erro responde `503`, `no-store` e fail-closed, sem tentar incluir conteúdo alternativo/local.
- O sitemap editorial possui namespace próprio e não altera `/sitemap.xml` nem `/sitemap_index.xml`.

## Estado antes da primeira publicação

Com zero artigos `published`, `/sitemap-blog.xml` continua XML válido e contém apenas a URL canônica do índice `/blog`. Nenhum draft, artigo em review ou scheduled é listado.

## robots.txt — proposta, não publicação

Foi criado `buildBlogRobotsTxtProposal(existingRobotsText)` apenas para futura reconciliação. Ele preserva integralmente o texto existente e acrescenta, sem duplicar:

`Sitemap: https://vejamais.com.br/sitemap-blog.xml`

Nenhum arquivo `public/robots.txt` e nenhuma rota `/robots.txt` foi criada nesta fase. Isso evita substituir regras históricas que não estão versionadas neste repositório.

## Proteções

- não substitui sitemap histórico;
- não altera sitemap index histórico;
- não publica robots.txt;
- não usa os artigos locais de preview como fallback;
- falha fechada quando a consulta pública falha;
- drafts/review/scheduled permanecem excluídos;
- nenhum envio ao Google Search Console nesta fase.

## Próxima validação

Antes de qualquer deploy, validar CI/build e o route tree gerado para `/sitemap-blog.xml`, além de provar que, com o estado atual do staging, nenhum dos três artigos entra no XML editorial.