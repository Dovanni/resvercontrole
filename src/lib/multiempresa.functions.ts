import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve o contexto multiempresa canônico para o usuário autenticado.
 * Substitui SELECTs diretos e garante isolamento via RPC.
 */
export const getMyMultiempresaContext = createServerFn({ method: "GET" })
  .handler(async () => {
    // A RPC usa auth.uid() internamente, garantindo segurança
    const { data, error } = await supabase.rpc('get_my_multiempresa_context');

    if (error) {
      console.error("Erro na RPC get_my_multiempresa_context:", error);
      throw new Error("Erro ao carregar contexto de empresas");
    }

    if (!data || data.length === 0) {
      // Se não houver empresas, o frontend tratará o estado vazio explicativo
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

