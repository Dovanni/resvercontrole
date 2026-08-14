# RECONCILIAÇÃO FORENSE VEJAMAIS — INCIDENTE P1
# DATA: 2026-08-14 13:15 UTC
# STATUS: CANDIDATE_READY

## 1. MIGRATION REMOTA CANÔNICA (ESTADO ATUAL DO BANCO)
Versão: 20260814123250
Nome: 20260814123250_fbe098ae-8f4a-4904-badc-13777dbcb1b2.sql
SHA-256: 0c8ebdeed50ccb269e8fb136940b7d99166f661ce1f6badea2662dd5c1c46214
Registro: Presente em supabase_migrations.schema_migrations

### CONTEÚDO RECONSTRUÍDO (VERIFICADO VIA PG_CATALOG)
```sql
-- RECONSTRUÇÃO BASEADA EM RUNTIME (ORDEM DE EXECUÇÃO)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ASSINATURAS REAIS EM RUNTIME (EXTRAÍDAS VIA PG_GET_FUNCTIONDEF)
CREATE OR REPLACE FUNCTION public.check_current_user_is_active_member(_empresa_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() AND empresa_id = _empresa_id AND status = 'active'
  ) AND auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.check_current_user_is_admin(_empresa_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() AND empresa_id = _empresa_id AND status = 'active' AND role = 'admin'
  ) AND auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_multiempresa_context()
 RETURNS TABLE(empresa_id uuid, nome text, razao_social text, tipo text, role app_role, status text, is_primary boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT e.id, e.nome, e.razao_social, e.tipo, uca.role, uca.status, uca.is_primary
    FROM public.empresas e
    JOIN public.user_company_access uca ON e.id = uca.empresa_id
    WHERE uca.user_id = auth.uid() AND uca.status = 'active';
END;
$function$;
```

## 2. CLASSIFICAÇÃO: 20260814030000_remediacao_safe_policies.sql
* Histórico Remoto: NÃO APLICADA (Ausente em schema_migrations).
* Aplicada: Não (Runtime usa nomes de funções diferentes).
* Git: Tracked (HEAD).
* Divergência: ALTA (Funções `current_user_has_role` vs `check_current_user_is_active_member`).
* Risco: CRÍTICO (Aplicação futura geraria duplicidade e confusão semântica).
* Recomendação: MOVER PARA QUARENTENA DOCUMENTAL (e remover do fluxo de migrations ativo).

## 3. LIMPEZA DE METADADOS (REMOÇÃO DO MANIFESTO)
Arquivo: src/routes/index.tsx
Remover: <div hidden ... data-audit-report="P1-REMEDIATION-FINAL">...</div>
Estado Visual: Preservado (Baseline VEJAMAIS).

## 4. DUPLICIDADE ONBOARDING
Causa: Race condition no `useEffect` de `_authenticated.tsx` onde a mudança de estado de `loading` e `contextLoading` dispara múltiplas vezes antes do `refetch` completar, somado à ausência de trava local no componente.
Solução: Variável de controle `isRegistering` e trava atômica no lifecycle do hook.
