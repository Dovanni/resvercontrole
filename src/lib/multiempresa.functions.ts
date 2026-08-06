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

    // Busca a empresa onde o usuário tem vínculo ativo
    // Na Wave B, começamos a suportar a troca de empresa, mas por enquanto pegamos a primeira ativa
    const { data: access, error } = await supabase
      .from("user_company_access")
      .select("empresa_id, role, status, empresas(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (error || !access) {
      throw new Error("Nenhuma empresa ativa encontrada para este usuário.");
    }

    return {
      ...access.empresas,
      user_role: access.role,
      membership_status: access.status
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
      .select("role, status, empresas(*)")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) throw error;
    return data.map(item => ({
      ...item.empresas,
      user_role: item.role,
      membership_status: item.status
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
