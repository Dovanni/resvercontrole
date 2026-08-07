-- VMEAP WAVE B: EVOLUÇÃO DE SCHEMA PARA MULTIEMPRESA
-- 1. Adicionar colunas de metadados à tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'matriz',
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.empresas(id),
ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{}'::jsonb;

-- Add check constraint separately to avoid inline issues if needed, but simple IN is fine
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresas_tipo_check') THEN
        ALTER TABLE public.empresas ADD CONSTRAINT empresas_tipo_check CHECK (tipo IN ('matriz', 'filial', 'unidade'));
    END IF;
END $$;

-- 2. Adicionar is_primary à tabela user_company_access
ALTER TABLE public.user_company_access 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- 3. Marcar a primeira empresa de cada usuário como primária (Backfill is_primary)
DO $$
BEGIN
    UPDATE public.user_company_access uca
    SET is_primary = true
    WHERE id IN (
        SELECT DISTINCT ON (user_id) id
        FROM public.user_company_access
        ORDER BY user_id, created_at ASC
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.user_company_access u2 
        WHERE u2.user_id = uca.user_id AND u2.is_primary = true
    );
END $$;

-- 4. Criar tabela de convites (Camada Interna Wave B)
CREATE TABLE IF NOT EXISTS public.company_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'vendedor',
    token_hash TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

-- Separate constraints
ALTER TABLE public.company_invitations DROP CONSTRAINT IF EXISTS company_invitations_status_check;
ALTER TABLE public.company_invitations ADD CONSTRAINT company_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));

-- Conditional unique index instead of constraint
CREATE UNIQUE INDEX IF NOT EXISTS company_invitations_active_idx ON public.company_invitations (empresa_id, email) WHERE (status = 'pending');
CREATE UNIQUE INDEX IF NOT EXISTS company_invitations_token_hash_idx ON public.company_invitations (token_hash);

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.company_invitations TO authenticated;
GRANT ALL ON public.company_invitations TO service_role;

-- RLS: Somente admins da empresa podem ver/criar convites
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
CREATE POLICY "Admins can manage invitations"
ON public.company_invitations FOR ALL
TO authenticated
USING (public.has_role_in_company(auth.uid(), empresa_id, 'admin'));

-- 5. Função para aceitar convite (Camada Interna)
CREATE OR REPLACE FUNCTION public.accept_company_invitation(_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation_id UUID;
    v_empresa_id UUID;
    v_role public.app_role;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado';
    END IF;

    SELECT id, empresa_id, role INTO v_invitation_id, v_empresa_id, v_role
    FROM public.company_invitations
    WHERE token_hash = _token_hash
      AND status = 'pending'
      AND expires_at > now();

    IF v_invitation_id IS NULL THEN
        RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado';
    END IF;

    -- Criar o acesso
    INSERT INTO public.user_company_access (user_id, empresa_id, role)
    VALUES (v_user_id, v_empresa_id, v_role)
    ON CONFLICT (user_id, empresa_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active';

    -- Marcar convite como aceito
    UPDATE public.company_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invitation_id;

    RETURN TRUE;
END;
$$;
