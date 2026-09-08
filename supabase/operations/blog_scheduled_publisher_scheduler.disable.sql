-- VEJAMAIS ERP — Blog Editorial V2
-- R9.11 — DESATIVAÇÃO CONTROLADA DO SCHEDULER

begin;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vejamais-blog-scheduled-publisher';

commit;

-- Mantém pg_cron instalado; remove somente o job.
-- Verificação esperada: zero linhas em cron.job para esse jobname.
