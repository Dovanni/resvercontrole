# VEJAMAIS ERP — Blog Editorial V2

## Fase 3-I.4 — Consolidação Pós-Laboratório

Status: execução autorizada com `vejamais-erp-staging` fora de qualquer alteração.

## 1. Hardening promovido

Os ajustes comprovados na Fase 3-I.3 foram promovidos do script manual de laboratório para o pacote de migrations do Blog:

- índices das FKs de auditoria apontadas pelos Supabase Advisors;
- policies SELECT separadas por `anon` e `authenticated` para eliminar sobreposição permissiva;
- policy UPDATE de `blog_posts` consolidada;
- trigger `guard_blog_post_write()` continua sendo a camada autoritativa para transições, four-eyes e publicação.

Arquivo promovido:

- `supabase/migrations/20260902143101_blog_editorial_v2_post_lab_hardening.sql`

O antigo script manual `supabase/manual/blog_editorial_v2_lab_advisor_hardening.sql` foi removido para evitar duas fontes de verdade.

> Observação: o objetivo final continua sendo squashar este hardening na migration canônica antes da primeira aplicação no staging. Como a migration canônica já foi executada no laboratório e o hardening foi validado separadamente, mantê-los temporariamente como dois arquivos preserva a rastreabilidade exata da evidência. Nenhuma aplicação no staging está autorizada.

## 2. Advisors pós-hardening

No `vejamais-blog-lab`, após o hardening:

- `unindexed_foreign_keys`: eliminado;
- `multiple_permissive_policies`: eliminado;
- permaneceram apenas avisos `unused_index`, esperados em banco recém-criado e sem carga representativa.

O warning de `public.set_updated_at()` não pertence ao Blog e não foi alterado.

## 3. Regressão de segurança

Após o hardening:

- usuário ERP comum continuou sem enxergar conteúdo não público;
- author continuou autorizado apenas dentro do próprio fluxo de draft/review;
- os contratos de four-eyes e workflow permanecem sob o trigger já validado.

## 4. Rollback

O rollback foi corrigido para não tentar `DELETE FROM storage.buckets`, operação bloqueada pelo Supabase.

Novo contrato:

1. confirmar que `blog-media` está vazio;
2. remover o bucket pela Storage API/Dashboard oficial;
3. somente então executar `supabase/rollback/20260902143100_blog_editorial_v2_schema.rollback.sql`;
4. confirmar remoção dos objetos `blog_*` e `blog_private`;
5. confirmar preservação de `public.set_updated_at()`.

No laboratório foi confirmado que `blog-media` contém 0 objetos.

O conector disponível nesta execução não expõe uma operação de `deleteBucket`; por isso o bucket não foi removido por SQL nem por mecanismo não suportado. O rollback SQL completo permanece deliberadamente bloqueado até a remoção oficial do bucket.

## 5. Staging

O histórico de migrations do `vejamais-erp-staging` foi consultado após esta fase. A migration mais recente continua sendo `20260831124358_fix_stripe_invoice_subscription_resolution`. Nenhuma migration do Blog foi aplicada ao staging.

## 6. Estado

- repositório: hardening promovido e documentado;
- laboratório: módulo editorial ainda presente, bucket vazio;
- rollback: guard validado, execução integral pendente somente da remoção oficial do bucket;
- staging: intacto;
- produção/Cloudflare: intactos.
