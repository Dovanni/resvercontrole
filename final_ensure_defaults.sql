CREATE OR REPLACE FUNCTION public.ensure_empresa_defaults(_empresa_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- A. Provisionar Categorias de Contas a Pagar
    -- 1. Mercadorias para Revenda
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Mercadorias para Revenda', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;

    -- 2. Serviços Tomados
    INSERT INTO public.categorias_contas_pagar (nome, padrao, user_id, empresa_id)
    VALUES ('Serviços Tomados', true, _user_id, _empresa_id)
    ON CONFLICT (nome, empresa_id) DO NOTHING;
END;
$function$

