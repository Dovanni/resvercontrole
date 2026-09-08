-- VEJAMAIS ERP — Blog Editorial V2
-- R9.11 — OPERAÇÃO CONTROLADA DE ATIVAÇÃO DO SCHEDULER
-- NÃO é migration automática. Executar somente após gate explícito.
-- Pré-requisitos: R9 publisher aplicado e homologado; execução como postgres.

begin;

create extension if not exists pg_cron;

-- Idempotência operacional: evita duplicidade por nome.
select cron.unschedule(jobid)
from cron.job
where jobname = 'vejamais-blog-scheduled-publisher';

select cron.schedule(
  'vejamais-blog-scheduled-publisher',
  '* * * * *',
  $$select count(*) from blog_private.publish_due_scheduled_posts(50);$$
);

commit;

-- Verificação esperada:
-- select jobid, jobname, schedule, command, username, active
-- from cron.job where jobname = 'vejamais-blog-scheduled-publisher';
