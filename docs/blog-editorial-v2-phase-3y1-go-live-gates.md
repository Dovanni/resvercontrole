# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-Y.1 — Fechamento dos Gates de Go-Live

Status: **AUDITORIA CONCLUÍDA — GO-LIVE BLOQUEADO PELO GATE DE AMBIENTE**.

Esta fase foi executada sem merge em `main`, sem deploy, sem migration adicional, sem publicação de artigos, sem alteração de Cloudflare/DNS, sem Search Console e sem escrita adicional no Supabase.

## Gate Y-1 — Supabase efetivamente usado pelo ambiente público

### Evidência do repositório

Na branch `feature/blog-editorial-v2`, o arquivo `.env` versionado aponta o projeto Supabase legado:

- project ref: `bsrjtmssbnvttzrvnaab`;
- URL correspondente: `https://bsrjtmssbnvttzrvnaab.supabase.co`.

O cliente Supabase do aplicativo resolve as credenciais por `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` no cliente e possui fallback de SSR por `process.env.SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`.

### Evidência do módulo Blog

O Blog Editorial V2 foi homologado e recebeu suas migrations no projeto:

- `vejamais-erp-staging`;
- project ref `hoalgniwydgydqaugqph`.

A conexão Supabase disponível nesta auditoria também lista `vejamais-blog-lab`, mas não lista o projeto legado `bsrjtmssbnvttzrvnaab`.

### Limitação de evidência

Não existe, nesta sessão, uma conexão Cloudflare capaz de ler as variáveis efetivamente configuradas no Worker/Pages que atende `vejamais.com.br`.

Portanto não é possível provar se o ambiente público substitui o `.env` durante build/runtime ou se conserva o project ref legado.

### Veredito

**GATE Y-1: BLOQUEADO / NO-GO.**

É proibido executar deploy do Blog enquanto não houver evidência objetiva da URL/project ref Supabase usada pelo ambiente Cloudflare público.

Não alterar o `.env` por hipótese. Não executar migrations no projeto legado. Não assumir `vejamais-erp-staging` como produção.

## Gate Y-2 — Descoberta pública do Blog

### Estado vivo

A landing pública continua sem entrada `Blog` no menu principal e no footer.

### Estado da branch

A branch também ainda não contém `Blog` no array `NAV` da landing nem na lista `Plataforma` do footer.

### Decisão homologada

Para o lançamento público, o contrato de navegação aprovado é:

1. incluir `Blog` na navegação principal desktop;
2. incluir `Blog` na navegação mobile;
3. incluir `Blog` no grupo `Plataforma` do footer;
4. usar navegação interna TanStack `Link to="/blog"`, e não anchor de seção `#...`;
5. preservar integralmente os CTAs de login/cadastro e os demais itens existentes;
6. validar ausência de overflow no header desktop e comportamento do menu mobile antes do merge.

A alteração não foi aplicada nesta fase porque o Gate Y-1 permanece bloqueante e não é necessário aumentar o diff antes de confirmar o destino de ambiente. A especificação acima torna a mudança determinística para a próxima etapa repository-only.

**GATE Y-2: DECISÃO FECHADA; IMPLEMENTAÇÃO PENDENTE POR ORDEM DE SEGURANÇA.**

## Gate Y-3 — Integração branch → main

Comparação executada após o fechamento da Fase 3-Y:

- base: `main`;
- head: `feature/blog-editorial-v2`;
- status: `ahead`;
- branch ahead: 106 commits;
- branch behind: 0 commits;
- merge-base/base SHA: `1c878ee6e59ba6c2ba80a191dabf711e7ff89067`.

O conjunto alterado permanece concentrado no Blog Editorial V2, documentação/CI, route tree, migrations/rollback editoriais e rotas do Blog/Editorial/Sitemap.

Nenhum PR foi aberto e nenhum merge foi executado.

**GATE Y-3: TECNICAMENTE PRONTO PARA MANIFESTO, MAS PR BLOQUEADO PELO GATE Y-1.**

## Manifesto exato pré-PR

Antes de abrir PR `feature/blog-editorial-v2` → `main`:

1. confirmar por evidência as variáveis Supabase efetivas do ambiente Cloudflare de `vejamais.com.br`;
2. classificar explicitamente o banco resultante como staging, produção ou legado;
3. comparar migrations editoriais no banco de destino real sem aplicar nada;
4. somente então implementar a entrada `Blog` na landing conforme Gate Y-2;
5. executar CI completo da branch;
6. confirmar `behind_by = 0` novamente imediatamente antes do PR;
7. revisar o diff final e registrar SHA exato;
8. abrir PR sem merge automático.

## Manifesto de deploy futuro

O deploy somente poderá ser autorizado quando todos os itens abaixo estiverem verdes:

- Supabase de destino público comprovado;
- migrations editoriais reconciliadas no destino real;
- link `Blog` homologado desktop/mobile/footer;
- CI completo verde;
- route tree sincronizado;
- branch não atrasada em relação a `main`;
- PR revisado e aprovado;
- SHA de merge fixado;
- plano de smoke tests e rollback preservado.

## Estado final da Fase 3-Y.1

- auditoria dos gates: concluída;
- identidade do Supabase usado pelo Cloudflare público: **não comprovada**;
- divergência potencial `.env legado` × `staging homologado`: **confirmada**;
- decisão arquitetural do link Blog: **fechada**;
- implementação do link Blog: **adiada até fechamento do ambiente**;
- comparação branch/main: **ahead 106 / behind 0**;
- PR: não aberto;
- merge: não;
- deploy: não;
- Supabase: nenhuma alteração;
- Cloudflare/DNS: nenhuma alteração;
- artigos publicados: nenhum.

## Próxima etapa segura

**Fase 3-Y.2 — Identificação do Runtime Público e Reconciliação de Ambiente**, exclusivamente em leitura, para obter evidência da variável Supabase efetiva do ambiente que atende `vejamais.com.br` e comparar esse destino com o staging editorial antes de qualquer alteração.
