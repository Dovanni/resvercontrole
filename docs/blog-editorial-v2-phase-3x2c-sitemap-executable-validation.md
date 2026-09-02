# Fase 3-X.2C — Validação Executável do sitemap-blog.xml e Reconciliação Read-Only do robots.txt

Escopo: validação/reconciliação sem deploy. Nenhuma alteração foi feita em Supabase, Search Console, Cloudflare, DNS, robots.txt vivo ou publicação editorial.

## CI e build

- Workflow `Blog Editorial V2 Validation` run `33689923411`: `completed / success`.
- 9 arquivos de teste passaram.
- 79 testes passaram.
- Build client, SSR e Nitro/Cloudflare concluíram com sucesso.
- A rota server-side `src/routes/sitemap-blog[.]xml.tsx` foi aceita pelo pipeline.

## Contrato da rota

`/sitemap-blog.xml`:

- consulta exclusivamente `listPublishedBlogArticles()`;
- responde XML em sucesso;
- usa cache curto;
- responde 503/no-store em falha;
- não possui fallback para artigos locais;
- mantém `X-Robots-Tag: noindex` no próprio arquivo.

## Estado real do staging durante a validação

- total_posts: 3
- draft: 2
- review: 1
- scheduled: 0
- published: 0
- publicly_eligible: 0

Logo, no estado atual, nenhum dos três artigos pode entrar no sitemap editorial. O XML projetado contém apenas a URL canônica do índice `/blog`.

## Route tree

O arquivo versionado `src/routeTree.gen.ts` está atrasado e não contém ainda as rotas do Blog/sitemap. Entretanto, TanStack Router regenera o route tree durante a execução de testes/build e o CI passou integralmente. O arquivo gerado não deve ser editado manualmente. Antes de deploy/merge, deve ser consolidado pelo gerador oficial do projeto e revisado no diff.

## robots.txt vivo

A tentativa de leitura pública pelo mecanismo disponível não recuperou o conteúdo atual de `https://vejamais.com.br/robots.txt`; o endpoint não apareceu indexado e não foi possível obter uma resposta direta confiável por essa via.

Por segurança, nenhuma regra foi presumida e nenhuma proposta foi aplicada. A função repository-only `buildBlogRobotsTxtProposal(existingRobotsText)` continua apenas como reconciliador futuro: ela deve receber o conteúdo vivo real, preservar todas as regras existentes e acrescentar somente `Sitemap: https://vejamais.com.br/sitemap-blog.xml` se ausente.

## Decisão

A implementação de `/sitemap-blog.xml` está validada em CI, mas a publicação de qualquer `robots.txt` continua bloqueada até leitura confiável do arquivo vivo. Nenhum envio ao Google Search Console deve ocorrer antes do deploy controlado e da validação HTTP real do novo sitemap.
