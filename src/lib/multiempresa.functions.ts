import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a empresa ativa para o usuário atual.
 * Na Wave A, como ainda estamos em transição e a flag está false,
 * retornamos a empresa vinculada ao user_id (criada no backfill).
 */
export const getActiveEmpresa = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    // Busca a empresa onde o usuário é dono ou tem vínculo
    const { data: access, error } = await supabase
      .from("user_company_access")
      .select("empresa_id, empresas(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (error || !access) {
      throw new Error("Nenhuma empresa ativa encontrada para este usuário.");
    }

    return access.empresas;
  });
