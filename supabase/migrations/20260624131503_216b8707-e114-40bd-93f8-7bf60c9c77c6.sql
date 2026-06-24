
-- 1) Apagar duplicatas pendentes (mantém o mais antigo)
WITH dups AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, description, due_date, amount
           ORDER BY created_at, id
         ) AS rn
  FROM public.payables
  WHERE status IN ('pendente','atrasado')
)
DELETE FROM public.payables p
USING dups
WHERE p.id = dups.id AND dups.rn > 1;

-- 2) Índice único parcial para evitar duplicatas pendentes futuras
CREATE UNIQUE INDEX IF NOT EXISTS payables_unique_pendente
  ON public.payables (user_id, description, due_date, amount)
  WHERE status IN ('pendente','atrasado');
