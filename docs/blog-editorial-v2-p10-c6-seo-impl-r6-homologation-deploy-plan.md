# P.10-C6.SEO-IMPL-R6 — preparação de homologação/deploy controlado

## Objetivo

Preparar a homologação da branch `feat/blog-seo-controls-r0` após a validação funcional R5.V, sem executar deploy, merge, auto-merge ou alteração adicional no Supabase.

## Baseline validada

- PR: `#14`
- Branch: `feat/blog-seo-controls-r0`
- Head de entrada da R6: `3cc22ef833908bdd2a928dd6ee097783d194be8e`
- `BLOG_SEO_PERSISTENCE_READY = true`
- Blog Lab real já possui a migration R2 aplicada e validada funcionalmente.
- RPC `blog_save_draft_transaction` já opera com 19 argumentos no Blog Lab.
- R5.V comprovou leitura, escrita, normalização `noindex => sitemap=false`, revisão, snapshot e conflito otimista, sem resíduos.

## Descoberta crítica de deploy

O `wrangler.jsonc` atual fixa o Worker como `resvercontrole`.

Consequência: executar diretamente, a partir desta branch, o fluxo normal de produção (`npm run build` seguido de `npx nitro deploy --prebuilt`) pode apontar para o mesmo Worker usado em produção. Portanto, **esse comando não deve ser executado nesta fase**.

A homologação segura deve usar um alvo Cloudflare isolado, com nome próprio e sem `routes` ou `custom_domain`, antes de qualquer publicação da branch.

## Gate obrigatório antes do deploy de homologação

O próximo deploy só poderá ocorrer quando houver confirmação explícita de um Worker isolado, por exemplo `resvercontrole-seo-r6-homolog`, ou outro nome aprovado, na mesma conta Cloudflare, sem associação a `vejamais.com.br`.

O alvo de homologação deve cumprir simultaneamente:

1. nome diferente de `resvercontrole`;
2. nenhuma rota de domínio customizado;
3. nenhuma alteração de DNS;
4. nenhum overwrite do Worker de produção;
5. mesmas variáveis públicas necessárias ao Blog Editorial;
6. build produzido exatamente a partir do head aprovado da branch;
7. validação visual e funcional somente no `*.workers.dev` de homologação.

## Sequência preparada para a próxima fase

Após criação/confirmação do alvo isolado e nova autorização:

```powershell
git fetch origin
git switch feat/blog-seo-controls-r0
git pull --ff-only origin feat/blog-seo-controls-r0
git rev-parse HEAD
npm install --no-audit --no-fund
npx vitest run src/features/blog/*.test.ts
npm run build
```

Antes de publicar, o SHA exibido por `git rev-parse HEAD` deverá coincidir exatamente com o head aprovado no gate de deploy.

O comando de publicação do alvo de homologação **não está liberado neste documento**. Ele só deverá ser definido/executado depois de confirmar que o nome e a configuração efetivos não atingem `resvercontrole` nem o domínio `vejamais.com.br`.

## Checklist de homologação funcional

No Worker isolado, validar sem alterar o artigo piloto publicado:

- `/editorial` autentica com a sessão exclusiva do Blog;
- `/editorial/editor` carrega sem erro de coluna/RPC;
- badge de persistência SEO aparece como disponível;
- controles `Indexar este artigo`, `Permitir seguir links` e `Incluir no sitemap` ficam habilitados somente em draft editável;
- `noindex` desliga e bloqueia sitemap;
- um draft temporário pode ser criado/salvo com os 19 argumentos;
- reload preserva os três valores SEO;
- nova alteração SEO incrementa a revisão;
- nenhum conteúdo publicado existente é editado durante a homologação;
- ao final, qualquer draft temporário criado deve ser removido apenas em fase explicitamente autorizada ou mantido identificado para limpeza controlada.

## Rollback operacional

Como esta R6 não executa deploy, não há rollback Cloudflare a realizar.

Se uma futura homologação for publicada em Worker isolado e falhar, o rollback operacional será simplesmente remover/desativar o Worker de homologação ou publicar novamente seu último artefato conhecido. O Worker `resvercontrole` e o domínio de produção não devem participar do rollback de homologação.

O rollback SQL da migration R2 permanece separado e **não deve ser executado** durante homologação de frontend, pois o Blog Lab real já está funcionalmente validado com o contrato de 19 argumentos.

## Limites da R6

- sem deploy Cloudflare;
- sem criação de Worker;
- sem alteração de DNS/rotas/custom domain;
- sem merge;
- sem auto-merge;
- sem mudança no artigo piloto;
- sem nova migration;
- sem rollback SQL;
- sem alteração no ERP staging.

## Resultado esperado

A R6 termina em `PREPARED / HOLD FOR ISOLATED CLOUDFLARE TARGET`: código e runbook estão prontos, porém a publicação só pode avançar após confirmação explícita de um alvo Cloudflare isolado que não sobrescreva produção.
