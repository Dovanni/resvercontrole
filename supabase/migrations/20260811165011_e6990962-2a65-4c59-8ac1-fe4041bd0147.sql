-- FASE 2: Correção Canônica - Proteção de integridade multiempresa para cartoes_lancamentos
-- Objetivo: Garantir que empresa_id seja derivado atomicamente do cartão e proteger contra cross-tenant.

-- 1. Criar função de gatilho para preenchimento e validação de empresa_id
CREATE OR REPLACE FUNCTION public.fn_handle_cartao_lancamento_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Buscar empresa_id do cartão
    SELECT empresa_id INTO v_empresa_id
    FROM public.cartoes_credito
    WHERE id = NEW.cartao_id;

    -- Validar existência do cartão
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Cartão não encontrado ou inválido' USING ERRCODE = '42P01';
    END IF;

    -- Preenchimento atômico ou validação
    IF NEW.empresa_id IS NULL THEN
        NEW.empresa_id := v_empresa_id;
    ELSIF NEW.empresa_id <> v_empresa_id THEN
        RAISE EXCEPTION 'Divergência de tenant: empresa_id informado não coincide com o cartão' USING ERRCODE = 'P0001';
    END IF;

    -- Bloqueio de troca de cartão para outra empresa em UPDATE
    IF TG_OP = 'UPDATE' THEN
        IF NEW.cartao_id <> OLD.cartao_id THEN
            IF (SELECT empresa_id FROM public.cartoes_credito WHERE id = NEW.cartao_id) <> OLD.empresa_id THEN
                RAISE EXCEPTION 'Não é permitido mover lançamentos entre cartões de empresas diferentes' USING ERRCODE = 'P0001';
            END IF;
        END IF;
        
        -- Impedir alteração manual de empresa_id
        IF NEW.empresa_id <> OLD.empresa_id THEN
             RAISE EXCEPTION 'Alteração manual de empresa_id não permitida' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Aplicar o trigger na tabela cartoes_lancamentos
DROP TRIGGER IF EXISTS tr_cartao_lancamento_empresa_id_gate ON public.cartoes_lancamentos;
CREATE TRIGGER tr_cartao_lancamento_empresa_id_gate
    BEFORE INSERT OR UPDATE ON public.cartoes_lancamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_handle_cartao_lancamento_empresa_id();

-- 3. Garantir que cartoes_faturas também siga a mesma regra (Fatura deve pertencer à empresa do cartão)
CREATE OR REPLACE FUNCTION public.fn_handle_cartao_fatura_empresa_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
BEGIN
    SELECT empresa_id INTO v_empresa_id
    FROM public.cartoes_credito
    WHERE id = NEW.cartao_id;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Cartão não encontrado ou inválido' USING ERRCODE = '42P01';
    END IF;

    IF NEW.empresa_id IS NULL THEN
        NEW.empresa_id := v_empresa_id;
    ELSIF NEW.empresa_id <> v_empresa_id THEN
        RAISE EXCEPTION 'Divergência de tenant na fatura' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cartao_fatura_empresa_id_gate ON public.cartoes_faturas;
CREATE TRIGGER tr_cartao_fatura_empresa_id_gate
    BEFORE INSERT OR UPDATE ON public.cartoes_faturas
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_handle_cartao_fatura_empresa_id();
