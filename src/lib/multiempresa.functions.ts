import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a empresa ativa para o usuário atual.
 * Wave B: Valida o membership e retorna a empresa ativa.
 */
export const getActiveEmpresa = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { data: access, error } = await supabase
      .from("user_company_access")
      .select(`
        empresa_id, 
        role, 
        status, 
        is_primary,
        empresas (
          id,
          nome,
          razao_social,
          logo_url,
          tipo,
          parent_id,
          configuracoes
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !access) {
      throw new Error("Nenhuma empresa ativa encontrada para este usuário.");
    }

    const companyData = access.empresas as any;
    return {
      ...companyData,
      user_role: access.role,
      membership_status: access.status,
      is_primary: access.is_primary
    };
  });

/**
 * Lista todas as empresas que o usuário tem acesso.
 */
export const listMyCompanies = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { data, error } = await supabase
      .from("user_company_access")
      .select(`
        role, 
        status, 
        is_primary,
        empresas (
          id,
          nome,
          razao_social,
          logo_url,
          tipo,
          parent_id
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) throw error;
    return (data as any[]).map(item => ({
      ...item.empresas,
      user_role: item.role,
      membership_status: item.status,
      is_primary: item.is_primary
    }));
  });

/**
 * Valida se o usuário tem acesso a uma empresa específica.
 */
export const validateCompanyAccess = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    if (typeof data !== "string") throw new Error("ID da empresa inválido");
    return data;
  })
  .handler(async ({ data: empresaId }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { data, error } = await supabase
      .from("user_company_access")
      .select("empresa_id, role, status")
      .eq("user_id", user.id)
      .eq("empresa_id", empresaId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) {
      throw new Error("Acesso negado à empresa selecionada.");
    }

    return data;
  });
