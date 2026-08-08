-- FASE 1 - MIGRAÇÃO TRANSACIONAL

-- 1. Limpeza de dados duplicados e inconsistentes
-- Corrigir regras com bank_account_id de outra empresa
UPDATE public.payment_routing_rules p
SET bank_account_id = NULL
FROM public.bank_accounts ba
WHERE p.bank_account_id = ba.id
AND p.empresa_id != ba.empresa_id;

-- Manter apenas uma regra por (empresa_id, payment_method)
DELETE FROM public.payment_routing_rules
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id, payment_method ORDER BY created_at ASC, id ASC) as rn
        FROM public.payment_routing_rules
    ) t WHERE rn > 1
);

-- Manter apenas uma categoria por (empresa_id, nome)
DELETE FROM public.categorias_contas_pagar
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id, nome ORDER BY created_at ASC, id ASC) as rn
        FROM public.categorias_contas_pagar
    ) t WHERE rn > 1
);

-- 2. Alteração de Constraints Legadas para Canônicas
ALTER TABLE public.payment_routing_rules DROP CONSTRAINT IF EXISTS payment_routing_rules_user_id_payment_method_key;
ALTER TABLE public.payment_routing_rules ADD CONSTRAINT payment_routing_rules_empresa_id_payment_method_key UNIQUE (empresa_id, payment_method);

ALTER TABLE public.categorias_contas_pagar DROP CONSTRAINT IF EXISTS categorias_contas_pagar_user_id_nome_key;
ALTER TABLE public.categorias_contas_pagar ADD CONSTRAINT categorias_contas_pagar_empresa_id_nome_key UNIQUE (empresa_id, nome);

-- 3. Atualização da Função de Provisionamento (Harden & Scoped)
CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(p_user_id uuid, p_empresa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    DECLARE
      v_mp_id uuid;
    BEGIN
      -- Validar existência e membership legítimo
      IF NOT EXISTS (
        SELECT 1 FROM public.user_company_access
        WHERE user_id = p_user_id AND empresa_id = p_empresa_id AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'Acesso não autorizado ou inexistente para esta empresa.';
      END IF;

      -- 4. Concorrência: Bloqueio da linha da empresa para evitar criação duplicada de conta bancária
      PERFORM 1 FROM public.empresas WHERE id = p_empresa_id FOR UPDATE;

      -- Conta Bancária Padrão (Mercado Pago)
      SELECT id INTO v_mp_id FROM public.bank_accounts
      WHERE empresa_id = p_empresa_id AND (name = 'Mercado Pago' OR bank = 'Mercado Pago')
      LIMIT 1;

      IF v_mp_id IS NULL THEN
        INSERT INTO public.bank_accounts (user_id, empresa_id, name, bank, account_type, initial_balance, color, status)
        VALUES (p_user_id, p_empresa_id, 'Mercado Pago', 'Mercado Pago', 'digital', 0, '#00B1EA', 'ativa')
        RETURNING id INTO v_mp_id;
      END IF;

      -- Regras de Roteamento Padrão - ON CONFLICT por empresa_id
      IF v_mp_id IS NOT NULL THEN
        INSERT INTO public.payment_routing_rules (user_id, empresa_id, payment_method, bank_account_id, fixo) VALUES
          (p_user_id, p_empresa_id, 'cartao_credito', v_mp_id, true),
          (p_user_id, p_empresa_id, 'cartao_debito',  v_mp_id, true),
          (p_user_id, p_empresa_id, 'mercado_livre',  v_mp_id, true),
          (p_user_id, p_empresa_id, 'cartao',         v_mp_id, true),
          (p_user_id, p_empresa_id, 'pix',            NULL,  false),
          (p_user_id, p_empresa_id, 'pix_prazo',      NULL,  false),
          (p_user_id, p_empresa_id, 'deposito',       NULL,  false),
          (p_user_id, p_empresa_id, 'dinheiro',       NULL,  false),
          (p_user_id, p_empresa_id, 'transferencia',  NULL,  false),
          (p_user_id, p_empresa_id, 'boleto',         NULL,  false),
          (p_user_id, p_empresa_id, 'crediario',      NULL,  false),
          (p_user_id, p_empresa_id, 'prazo',          NULL,  false)
        ON CONFLICT (empresa_id, payment_method) DO UPDATE SET 
            bank_account_id = EXCLUDED.bank_account_id, 
            fixo = EXCLUDED.fixo,
            updated_at = now();
      END IF;

      -- Categorias Padrão - ON CONFLICT por empresa_id
      INSERT INTO public.categorias_contas_pagar (user_id, empresa_id, nome, padrao) VALUES
        (p_user_id, p_empresa_id, 'Fornecedor', true),
        (p_user_id, p_empresa_id, 'Logística', true),
        (p_user_id, p_empresa_id, 'Marketing', true),
        (p_user_id, p_empresa_id, 'Aluguel', true),
        (p_user_id, p_empresa_id, 'Impostos', true),
        (p_user_id, p_empresa_id, 'Cartão de Crédito', true),
        (p_user_id, p_empresa_id, 'Outros', true)
      ON CONFLICT (empresa_id, nome) DO UPDATE SET 
        padrao = EXCLUDED.padrao,
        updated_at = now();

    END;
$$;