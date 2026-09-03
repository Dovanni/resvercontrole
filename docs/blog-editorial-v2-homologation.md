# VEJAMAIS ERP — Blog Editorial V2

## Fase 2-D — Homologação Editorial e Visual

Status: **APROVADA em ambiente repository-only isolado**.

## Escopo homologado

- `/blog` em desktop e mobile.
- `/blog/$slug` em desktop e mobile.
- Busca por artigos.
- Filtro por categoria e limpeza dos filtros.
- Destaque editorial e cards.
- Navegação pelo CTA `Ler artigo`.
- Header e footer editoriais da marca.
- Breadcrumb.
- Área visual do artigo.
- Sumário lateral em desktop e ocultação planejada em mobile.
- Cinco seções estruturadas do artigo principal homologado.
- CTA contextual.
- Dois artigos relacionados.
- Canonical do Blog e do artigo.
- `noindex` durante o preview.
- JSON-LD `BlogPosting`.
- JSON-LD `BreadcrumbList`.
- Slug inexistente retornando HTTP 404 e shell editorial.
- Ausência de overflow horizontal em viewport mobile de 390 px.

## Evidência automatizada

Workflow run de homologação final: `33637793468`.

Commit homologado: `6241c12cb3df502d7f8419a6a85afe84cf1e1cb4`.

Conclusão do job: `success`.

Artefato: `blog-editorial-v2-homologation`.

Artifact ID: `9849613756`.

Digest SHA-256 do artefato:

`d7112e08d1eaf44d9aba83991cc1713b97e9f4843c561afae0b3d9118eea49b1`

As evidências incluíram capturas de Blog desktop, artigo desktop, 404 desktop, Blog mobile, artigo mobile e relatório JSON dos contratos.

## Resultado técnico

Todos os contratos definidos pela Fase 2-D foram aprovados no run final. A navegação client-side foi sincronizada explicitamente com o H1 do artigo antes das asserções, eliminando uma condição de corrida do teste sem exigir alteração no código visual do Blog.

Os 9 testes repository-only do domínio editorial e o build completo também passaram antes da auditoria em Chromium.

## Observação sobre 404 no console

O relatório pode registrar a mensagem de recurso 404 após o teste deliberado de `artigo-inexistente`. O contrato `no console errors before 404` foi aprovado; portanto esse registro corresponde ao cenário 404 intencional, não a uma falha da navegação normal.

## Inspeção visual

As capturas homologadas foram revisadas em desktop e mobile. Não foram observados overflow horizontal, sobreposição estrutural ou quebra visual bloqueante. A hierarquia editorial, cards, artigo, CTA e conteúdos relacionados permaneceram legíveis nos dois formatos.

## Segurança e isolamento

Esta homologação **não autoriza publicação**.

Permanece proibido nesta fase:

- merge em `main`;
- deploy em Cloudflare ou qualquer ambiente público;
- alteração no Supabase;
- criação de tabelas ou migrations;
- alteração de Auth, onboarding, multiempresa ou billing;
- mudança dos artigos de `draft` para `published`;
- remoção do `noindex` sem autorização explícita.

O workflow pesado de Chromium utilizado exclusivamente para esta homologação foi removido da branch após produzir a evidência final. O workflow leve de testes + build permanece como salvaguarda repository-only.
