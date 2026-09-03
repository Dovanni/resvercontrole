# Blog Editorial V2 — Fase 3-T — Editor com Read Model Real

## Escopo

Integração repository-only do `/editorial/editor` com artigos reais de `blog_posts`, mantendo toda persistência desabilitada.

## Implementação

Criado `src/features/blog/editorial-editor-read-model.ts` com:

- `listRealEditorialEditorOptions()` — lista artigos reais disponíveis ao membro editorial autenticado;
- `loadRealEditorialEditorForm(postId)` — carrega post, categoria, autor, tags e última decisão de review e converte para `EditorialEditorForm`.

A rota `/editorial/editor` deixou de depender dos três drafts locais para seleção do artigo e agora usa o read model real.

## Segurança

- sessão Auth obrigatória;
- membership editorial ativo obrigatório;
- RLS continua autoridade final;
- nenhum INSERT/UPDATE/DELETE/RPC/upload foi adicionado;
- botões de workflow continuam somente simulando `planEditorialCommand`;
- nenhuma chamada ao executor Supabase de escrita foi conectada.

## Estado esperado

Enquanto `blog_posts` estiver vazio, o seletor real ficará sem artigos. Isso é intencional e confirma que os três drafts homologados ainda não foram importados.

## Próximas fases propostas até lançamento definitivo

- 3-U — Executor de escrita controlado e homologação de uma mutação segura;
- 3-V — Importação controlada dos três drafts homologados;
- 3-W — Workflow real de revisão/four-eyes/agendamento;
- 3-X — SEO técnico público: Supabase published source, sitemap, canonical, JSON-LD e robots;
- 3-Y — Homologação final, merge e deploy controlado;
- 3-Z — Publicação inicial dos artigos e auditoria pós-lançamento/Search Console.

Nenhuma dessas fases é implicitamente autorizada por esta documentação.
