import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Resolve o contexto multiempresa canônico para o usuário autenticado.
 * Substitui SELECTs diretos e garante isolamento via RPC.
 */
export const getMyMultiempresaContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase: authenticatedClient } = context;
    const start = Date.now();
    try {
      // A RPC usa auth.uid() internamente, que será resolvido via o token do context
      const { data, error } = await authenticatedClient.rpc('get_my_multiempresa_context');

      const duration = Date.now() - start;
      if (error) {
        console.error("Primary Operation Error (Context):", {
          operation: "get_my_multiempresa_context",
          error_code: error.code,
          error_message: error.message,
          duration_ms: duration
        });
        throw new Error(`[${error.code}] Erro ao carregar contexto de empresas: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((item: any) => {
        // Resolve o nome real da empresa seguindo a prioridade:
        // 1. nome (da tabela empresas) se não for o placeholder
        // 2. razao_social
        // 3. Fallback "Empresa principal"
        const resolvedName = (item.nome && item.nome !== "Empresa Principal") 
          ? item.nome 
          : (item.razao_social || "Empresa principal");

        return {
          id: item.empresa_id,
          nome: resolvedName,
          razao_social: item.razao_social,
          tipo: item.tipo,
          user_role: item.role,
          membership_status: item.status,
          is_primary: item.is_primary
        };
      });
    } catch (err: any) {
      console.error("Critical Runtime Error in getMyMultiempresaContext:", err);
      throw err;
    }
  });

/**
 * Valida acesso a uma empresa específica usando a fonte canônica.
 */
export const validateCompanyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (typeof data !== "string") throw new Error("ID da empresa inválido");
    return data;
  })
  .handler(async ({ data: empresaId, context }) => {
    const { supabase: authenticatedClient, userId } = context;

    const { data, error } = await authenticatedClient
      .from("user_company_access")
      .select("empresa_id, role, status")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) {
      throw new Error("Acesso negado à empresa selecionada.");
    }

    return data;
  });

/**
 * Legado/Compatibilidade: Resolve a empresa principal.
 * Em breve será removido em favor do uso direto do contexto no hook.
 */
export const getActiveEmpresa = createServerFn({ method: "GET" })
  .handler(async () => {
    const companies = await getMyMultiempresaContext();
    const primary = companies.find(c => c.is_primary) || companies[0];
    
    if (!primary) {
      throw new Error("Nenhuma empresa ativa encontrada.");
    }
    
    return primary;
  });

/**
 * Lista membros de uma empresa específica (apenas para admins).
 */
export const listCompanyMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (typeof data !== "string") throw new Error("ID da empresa inválido");
    return data;
  })
  .handler(async ({ data: empresaId, context }) => {
    const { supabase: authenticatedClient } = context;
    const start = Date.now();
    try {
      const { data, error } = await authenticatedClient.rpc("list_my_company_members", {
        p_empresa_id: empresaId
      });
      
      const duration = Date.now() - start;
      if (error) {
        console.error("Secondary Operation Error (Members):", {
          operation: "list_my_company_members",
          error_code: error.code,
          error_message: error.message,
          duration_ms: duration
        });
        throw error;
      }
      return data || [];
    } catch (err: any) {
      console.error("Critical Runtime Error in listCompanyMembers:", err);
      throw err;
    }
  });

/**
 * Lista convites pendentes de uma empresa específica (apenas para admins).
 */
export const listCompanyInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (typeof data !== "string") throw new Error("ID da empresa inválido");
    return data;
  })
  .handler(async ({ data: empresaId, context }) => {
    const { supabase: authenticatedClient } = context;
    const start = Date.now();
    try {
      const { data, error } = await authenticatedClient
        .from("company_invitations")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("status", "pending");
        
      const duration = Date.now() - start;
      if (error) {
        console.error("Secondary Operation Error (Invitations):", {
          operation: "fetch_invitations",
          error_code: error.code,
          error_message: error.message,
          duration_ms: duration
        });
        throw error;
      }
      return data || [];
    } catch (err: any) {
      console.error("Critical Runtime Error in listCompanyInvitations:", err);
      throw err;
    }
  });

