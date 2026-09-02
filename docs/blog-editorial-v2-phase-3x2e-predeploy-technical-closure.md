# Fase 3-X.2E — Fechamento Técnico Pré-Deploy

## Escopo

Esta fase foi executada exclusivamente no repositório e em consultas HTTP públicas de somente leitura. Não houve deploy, merge em `main`, alteração no Supabase staging, publicação/agendamento de artigos, alteração de Cloudflare/DNS ou alteração do Google Search Console.

## Route tree — geração oficial

O `src/routeTree.gen.ts` não foi editado manualmente. O próprio pipeline oficial do projeto executou `npm run build` (Vite + TanStack Start), detectou o diff gerado pelo toolchain e o GitHub Actions versionou exatamente esse resultado no commit:

`6bfd070972c59ad6ad5e8e2d3d4291b40d24dc26` — `chore(router): sync generated route tree`.

O route tree consolidado contém as rotas do Blog Editorial V2:

- `/blog/`
- `/blog/$slug`
- `/editorial`
- `/editorial/editor`
- `/sitemap-blog.xml`

O workflow temporário usado para esta consolidação teve a permissão de escrita removida ao final. O workflow permanente voltou a `contents: read` e passou a executar, depois do build:

`git diff --exit-code -- src/routeTree.gen.ts`

Assim, futuras mudanças de rota deixam o CI vermelho se o route tree versionado ficar dessincronizado.

## robots.txt vivo — auditoria somente leitura

Em 2026-09-02, o endpoint público `https://vejamais.com.br/robots.txt` respondeu `HTTP/2 200`, `Content-Type: text/plain; charset=utf-8` e foi servido através do Cloudflare.

O corpo observado é identificado como `Cloudflare Managed content` e contém, entre outras regras:

- `User-agent: *`
- `Content-Signal: search=yes,ai-train=no,use=reference`
- `Allow: /`
- bloqueios `Disallow: /` para crawlers específicos como Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot e meta-externalagent.

Não foi observada nenhuma diretiva `Sitemap:` no robots vivo.

### Decisão de convivência

O Blog V2 NÃO criará nem substituirá `robots.txt` nesta fase. Como o arquivo é atualmente conteúdo gerenciado pelo Cloudflare, qualquer futura inclusão de:

`Sitemap: https://vejamais.com.br/sitemap-blog.xml`

deverá ser planejada como alteração explícita da configuração que atualmente produz o robots vivo, preservando integralmente as regras existentes. Essa mudança depende de autorização específica futura.

## Sitemap editorial

`/sitemap-blog.xml` permanece isolado dos sitemaps históricos e é alimentado exclusivamente pelo read model de artigos efetivamente publicados. Nenhum sitemap histórico (`/sitemap.xml`, `/sitemap_index.xml`) foi modificado.

## Alertas preexistentes fora de escopo

O build continua reportando avisos preexistentes não pertencentes a esta fase, incluindo o arquivo de teste sob `src/routes/__tests__/compras-idempotency.test.tsx`, deprecações de `createServerFn().inputValidator()` e avisos de tamanho de chunks. Nenhuma correção desses itens foi realizada.

## Estado de fechamento

- route tree gerado oficialmente: concluído;
- route tree versionado: concluído;
- CI com guard permanente de sincronismo: configurado;
- robots vivo: lido e reconciliado em somente leitura;
- robots vivo alterado: não;
- sitemap histórico alterado: não;
- Cloudflare/DNS alterado: não;
- Search Console alterado: não;
- Supabase staging alterado: não;
- artigos publicados: não;
- deploy: não;
- merge em `main`: não.

O pacote pode seguir para homologação pré-produção somente após o CI final desta consolidação permanecer verde e a comparação final contra `main` confirmar a preservação do escopo do Blog Editorial V2.
