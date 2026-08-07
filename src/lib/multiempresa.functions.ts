import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve o contexto multiempresa canônico para o usuário autenticado.
 * Substitui SELECTs diretos e garante isolamento via RPC.
 */
export const getMyMultiempresaContext = createServerFn({ method: "GET" })
  .handler(async () => {
    const start = Date.now();
    try {
      // A RPC usa auth.uid() internamente, garantindo segurança
      const { data, error } = await supabase.rpc('get_my_multiempresa_context');

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

      return data.map((item: any) => ({
        id: item.empresa_id,
        nome: item.nome,
        razao_social: item.razao_social,
        tipo: item.tipo,
        user_role: item.role,
        membership_status: item.status,
        is_primary: item.is_primary
      }));
    } catch (err: any) {
      console.error("Critical Runtime Error in getMyMultiempresaContext:", err);
      throw err;
    }
  });

/**
 * Valida acesso a uma empresa específica usando a fonte canônica.
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

