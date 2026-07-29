-- ============ DRE Tradicional: estruturas aditivas de classificação ============
-- Nenhum lançamento histórico é alterado. Apenas configuração/overrides.

CREATE TABLE public.dre_regras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_table text NOT NULL,
  match_category text,
  match_supplier_id uuid,
  dre_group text NOT NULL,
  treatment text NOT NULL DEFAULT 'DRE',
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dre_regras_source_table_chk CHECK (source_table IN ('payables','receivables','sales','compras','cartoes_lancamentos')),
  CONSTRAINT dre_regras_treatment_chk CHECK (treatment IN ('DRE','FORA_DRE')),
  CONSTRAINT dre_regras_group_chk CHECK (dre_group IN (
    'RECEITA_PRODUTOS','RECEITA_SERVICOS','RECEITA_FRETE','RECEITA_OUTRAS',
    'DEDUCAO_DESCONTO','DEDUCAO_DEVOLUCAO','DEDUCAO_CANCELAMENTO','DEDUCAO_TRIBUTO',
    'CMV','DESP_COMERCIAL','DESP_LOGISTICA','DESP_ADMINISTRATIVA','DESP_MANUTENCAO_TI',
    'DESP_PESSOAL','DESP_OCUPACAO','DESP_TRIBUTARIA','DESP_OUTRAS',
    'DEPRECIACAO','REC_FINANCEIRA','DESP_FINANCEIRA','IRPJ_CSLL',
    'FORA_PESSOAL_SOCIOS','FORA_ESTOQUE_ATIVO','FORA_LIQUIDACAO','FORA_APORTE','NAO_CLASSIFICADO'
  )),
  CONSTRAINT dre_regras_match_chk CHECK (match_category IS NOT NULL OR match_supplier_id IS NOT NULL)
);

CREATE UNIQUE INDEX dre_regras_unq ON public.dre_regras (
  tenant_id, source_table, COALESCE(match_supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(match_category, '')
);
CREATE INDEX dre_regras_tenant_idx ON public.dre_regras (tenant_id, source_table);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_regras TO authenticated;
GRANT ALL ON public.dre_regras TO service_role;
REVOKE ALL ON public.dre_regras FROM PUBLIC, anon;

ALTER TABLE public.dre_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dre_regras_select" ON public.dre_regras FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "dre_regras_insert" ON public.dre_regras FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid() AND user_id = auth.uid());
CREATE POLICY "dre_regras_update" ON public.dre_regras FOR UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "dre_regras_delete" ON public.dre_regras FOR DELETE TO authenticated USING (tenant_id = auth.uid());

CREATE TRIGGER dre_regras_set_updated_at BEFORE UPDATE ON public.dre_regras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dre_regras_audit AFTER INSERT OR UPDATE OR DELETE ON public.dre_regras
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ---------------------------------------------------------------------------

CREATE TABLE public.dre_classificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  dre_group text NOT NULL,
  treatment text NOT NULL DEFAULT 'DRE',
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dre_class_source_table_chk CHECK (source_table IN ('payables','receivables','sales','sale_items','compras','cartoes_lancamentos','bank_movements','finance_entries')),
  CONSTRAINT dre_class_treatment_chk CHECK (treatment IN ('DRE','FORA_DRE')),
  CONSTRAINT dre_class_group_chk CHECK (dre_group IN (
    'RECEITA_PRODUTOS','RECEITA_SERVICOS','RECEITA_FRETE','RECEITA_OUTRAS',
    'DEDUCAO_DESCONTO','DEDUCAO_DEVOLUCAO','DEDUCAO_CANCELAMENTO','DEDUCAO_TRIBUTO',
    'CMV','DESP_COMERCIAL','DESP_LOGISTICA','DESP_ADMINISTRATIVA','DESP_MANUTENCAO_TI',
    'DESP_PESSOAL','DESP_OCUPACAO','DESP_TRIBUTARIA','DESP_OUTRAS',
    'DEPRECIACAO','REC_FINANCEIRA','DESP_FINANCEIRA','IRPJ_CSLL',
    'FORA_PESSOAL_SOCIOS','FORA_ESTOQUE_ATIVO','FORA_LIQUIDACAO','FORA_APORTE','NAO_CLASSIFICADO'
  )),
  CONSTRAINT dre_class_unq UNIQUE (tenant_id, source_table, source_id)
);

CREATE INDEX dre_class_tenant_idx ON public.dre_classificacoes (tenant_id, source_table);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_classificacoes TO authenticated;
GRANT ALL ON public.dre_classificacoes TO service_role;
REVOKE ALL ON public.dre_classificacoes FROM PUBLIC, anon;

ALTER TABLE public.dre_classificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dre_class_select" ON public.dre_classificacoes FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "dre_class_insert" ON public.dre_classificacoes FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid() AND user_id = auth.uid());
CREATE POLICY "dre_class_update" ON public.dre_classificacoes FOR UPDATE TO authenticated USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "dre_class_delete" ON public.dre_classificacoes FOR DELETE TO authenticated USING (tenant_id = auth.uid());

CREATE TRIGGER dre_class_set_updated_at BEFORE UPDATE ON public.dre_classificacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER dre_class_audit AFTER INSERT OR UPDATE OR DELETE ON public.dre_classificacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============ Seed de regras padrão (configuração, não dado histórico) ============

INSERT INTO public.dre_regras (tenant_id, user_id, source_table, match_supplier_id, match_category, dre_group, treatment, justification)
SELECT s.user_id, s.user_id, 'payables', s.id, NULL, m.grp, m.trt, 'Regra padrão inicial do DRE Tradicional'
FROM public.suppliers s
JOIN (VALUES
  ('Lovable','DESP_ADMINISTRATIVA','DRE'),
  ('Bling','DESP_ADMINISTRATIVA','DRE'),
  ('ChatGPT','DESP_ADMINISTRATIVA','DRE'),
  ('Certificado Digital','DESP_ADMINISTRATIVA','DRE'),
  ('Claro','DESP_ADMINISTRATIVA','DRE'),
  ('Claro Net','DESP_ADMINISTRATIVA','DRE'),
  ('Five Print','DESP_ADMINISTRATIVA','DRE'),
  ('Kaio Rosa Infinyti','DESP_ADMINISTRATIVA','DRE'),
  ('Posto de Gasolina','DESP_COMERCIAL','DRE'),
  ('Correios','FORA_LIQUIDACAO','FORA_DRE'),
  ('Unitrans Transportadora','FORA_LIQUIDACAO','FORA_DRE'),
  ('DAS MEI','DESP_TRIBUTARIA','DRE'),
  ('Juros Iof','DESP_FINANCEIRA','DRE'),
  ('Bradesco Cesta Mensal','DESP_FINANCEIRA','DRE'),
  ('Cartão 9026 Cesta Mensal','DESP_FINANCEIRA','DRE'),
  ('Resvera Vitta Cosméticos','FORA_ESTOQUE_ATIVO','FORA_DRE'),
  ('Vie Capillaire','FORA_ESTOQUE_ATIVO','FORA_DRE'),
  ('Plaspuma','FORA_ESTOQUE_ATIVO','FORA_DRE'),
  ('Aquario','FORA_ESTOQUE_ATIVO','FORA_DRE'),
  ('Revita','FORA_ESTOQUE_ATIVO','FORA_DRE'),
  ('Cartão M Pago Angela','FORA_LIQUIDACAO','FORA_DRE'),
  ('Cartão Tenda Anuidade','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Cartão Inter','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Cartão Itau','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Cartão Porto','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Cartão Santander','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Muffato','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Marfrios','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Porecatu','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Farmacia','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Componel','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('IPTU','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('IPVA','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('SEMAE','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('CPFL','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('PREVER','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Manutenção da Casa','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Licenciamento - Astra','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Atacadão das Baterias','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Eduardo Carraro','FORA_PESSOAL_SOCIOS','FORA_DRE')
) AS m(nome, grp, trt) ON m.nome = s.name
ON CONFLICT DO NOTHING;

-- Refinamentos por fornecedor + categoria (maior especificidade)
INSERT INTO public.dre_regras (tenant_id, user_id, source_table, match_supplier_id, match_category, dre_group, treatment, justification)
SELECT s.user_id, s.user_id, 'payables', s.id, m.cat, m.grp, m.trt, 'Regra padrão inicial do DRE Tradicional (fornecedor + categoria)'
FROM public.suppliers s
JOIN (VALUES
  ('Juros Iof','Cartão de Credito Tenda','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Cartão M Pago Angela','Merli','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Cartão M Pago Angela','Roberto','FORA_LIQUIDACAO','FORA_DRE')
) AS m(nome, cat, grp, trt) ON m.nome = s.name
ON CONFLICT DO NOTHING;

-- Regras por categoria (fallback quando não há regra de fornecedor)
INSERT INTO public.dre_regras (tenant_id, user_id, source_table, match_supplier_id, match_category, dre_group, treatment, justification)
SELECT DISTINCT p.user_id, p.user_id, 'payables', NULL::uuid, m.cat, m.grp, m.trt, 'Regra padrão inicial do DRE Tradicional (categoria)'
FROM public.payables p
JOIN (VALUES
  ('Fornecedor','FORA_ESTOQUE_ATIVO','FORA_DRE'),
  ('Fretes','FORA_LIQUIDACAO','FORA_DRE'),
  ('Impostos','DESP_TRIBUTARIA','DRE'),
  ('Combustivel','DESP_COMERCIAL','DRE'),
  ('Internet','DESP_ADMINISTRATIVA','DRE'),
  ('Sistema de Gestão','DESP_ADMINISTRATIVA','DRE'),
  ('Sistema de Desenvolvimento','DESP_ADMINISTRATIVA','DRE'),
  ('Cel 8636','DESP_ADMINISTRATIVA','DRE'),
  ('Claro 2622','DESP_ADMINISTRATIVA','DRE'),
  ('Bradesco Cesta Mensal','DESP_FINANCEIRA','DRE'),
  ('Casa','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Saude','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Veiculos','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Energia','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Merli','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Roberto','FORA_LIQUIDACAO','FORA_DRE'),
  ('IPTV','FORA_PESSOAL_SOCIOS','FORA_DRE'),
  ('Manutenção da Casa','FORA_PESSOAL_SOCIOS','FORA_DRE')
) AS m(cat, grp, trt) ON m.cat = p.category
ON CONFLICT DO NOTHING;

-- Overrides pontuais: rendimentos de investimento reconhecidos como receita financeira
INSERT INTO public.dre_classificacoes (tenant_id, user_id, source_table, source_id, dre_group, treatment, justification)
SELECT r.user_id, r.user_id, 'receivables', r.id, 'REC_FINANCEIRA', 'DRE',
       'Rendimento de investimento reconhecido como receita financeira'
FROM public.receivables r
WHERE r.sale_id IS NULL
  AND (r.description ILIKE '%juros%investimento%' OR r.description ILIKE '%juros de investimento%')
ON CONFLICT DO NOTHING;