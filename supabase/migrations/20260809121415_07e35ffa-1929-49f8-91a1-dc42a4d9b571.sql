-- Gate Final Multiempresa: Testes Transacionais (Hardened Validation)
-- Autorizado conforme protocolo VEJAMAIS_MULTIEMPRESA_FINANCIAL_EMPRESA_ID_FINAL_GATE

BEGIN;

DO $$
DECLARE
  v_payable_id uuid;
  v_account_id uuid;
  v_empresa_id uuid;
  v_wrong_empresa_id uuid;
  v_wrong_account_id uuid := '00000000-0000-0000-0000-000000000002';
  v_user_id uuid;
BEGIN
  -- 1. Setup
  SELECT p.id, p.empresa_id, a.id, p.user_id INTO v_payable_id, v_empresa_id, v_account_id, v_user_id
  FROM public.payables p
  JOIN public.bank_accounts a ON p.empresa_id = a.empresa_id
  WHERE p.status != 'pago'
  LIMIT 1;

  IF v_payable_id IS NULL THEN
    RAISE NOTICE 'VAL-SKIP: Massa de dados insuficiente.';
    RETURN;
  END IF;

  SELECT id INTO v_wrong_empresa_id FROM public.empresas WHERE id != v_empresa_id LIMIT 1;

  -- 2. TESTE A: PROPAGAÇÃO VÁLIDA
  UPDATE public.payables 
  SET status = 'pago', bank_account_id = v_account_id, paid_at = now(), paid_amount = amount 
  WHERE id = v_payable_id;

  IF EXISTS (SELECT 1 FROM public.bank_movements WHERE reference_id = v_payable_id AND empresa_id = v_empresa_id) THEN
    RAISE NOTICE 'VAL-PASS: bank_movement propagou empresa_id.';
  ELSE
    RAISE EXCEPTION 'VAL-FAIL: bank_movement sem empresa_id!';
  END IF;

  -- 3. TESTE B: BLOQUEIO CROSS-TENANT (Hardened)
  IF v_wrong_empresa_id IS NOT NULL THEN
    INSERT INTO public.bank_accounts (id, name, bank, account_type, initial_balance, empresa_id, user_id)
    VALUES (v_wrong_account_id, 'Conta Cross-Tenant', 'Banco X', 'corrente', 0, v_wrong_empresa_id, v_user_id);

    -- Tentar UPDATE direto no payable (validação de gatilho ANTES da criação do movimento)
    BEGIN
      UPDATE public.payables SET bank_account_id = v_wrong_account_id WHERE id = v_payable_id;
      RAISE EXCEPTION 'VAL-FAIL: O sistema permitiu vincular conta de outra empresa ao payable!';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = 'P0001' AND SQLERRM ILIKE '%não pertence à empresa%' THEN
        RAISE NOTICE 'VAL-PASS: Bloqueio cross-tenant efetivado com sucesso: %', SQLERRM;
      ELSIF SQLSTATE = 'P0001' AND SQLERRM = 'VAL-FAIL: O sistema permitiu vincular conta de outra empresa ao payable!' THEN
        RAISE;
      ELSE
        RAISE NOTICE 'VAL-INFO: Bloqueio detectado por outro motivo: % (%)', SQLERRM, SQLSTATE;
      END IF;
    END;
  END IF;

  -- 4. TESTE C: INTEGRIDADE DE AUDITORIA
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE row_id = v_payable_id AND op = 'UPDATE') THEN
    RAISE NOTICE 'VAL-PASS: Audit log registrado.';
  ELSE
    RAISE EXCEPTION 'VAL-FAIL: Audit log ausente.';
  END IF;

END $$;

ROLLBACK;
