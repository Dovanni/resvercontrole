import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

/**
 * Validação server-side de membership.
 * Garante que o usuário logado pertence à empresa e tem o papel necessário.
 */
export async function checkMembership(client: SupabaseClient<Database>, userId: string, empresaId: string, allowedRoles: string[] = []) {
  const { data, error } = await client
    .from("user_company_access")
    .select("role, status")
    .eq("user_id", userId)
    .eq("empresa_id", empresaId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Acesso negado: você não pertence a esta empresa ou o vínculo está inativo.");
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(data.role)) {
    throw new Error("Acesso negado: permissão insuficiente para esta operação.");
  }

  return data;
}

/**
 * Cria um convite interno para vincular um usuário a uma empresa.
 */
export const createInternalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    empresaId: z.string().uuid(),
    role: z.enum(["admin", "vendedor", "financeiro"]),
    email: z.string().email().optional(), // Opcional, o vínculo real é pelo token
  }))
  .handler(async ({ data, context }) => {
    // Apenas admins da empresa podem convidar
    await checkMembership(context.supabase, context.userId, data.empresaId, ["admin"]);

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    const { error } = await context.supabase.from("company_invitations").insert({
      empresa_id: data.empresaId,
      role: data.role,
      token_hash: token, // O schema usa token_hash
      expires_at: expiresAt.toISOString(),
      invited_by: context.userId,
      status: "pending",
      email: data.email || ""
    });

    if (error) throw error;

    return { token };
  });

/**
 * Aceita um convite via RPC seguro.
 */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    token: z.string(),
  }))
  .handler(async ({ data, context }) => {
    // Chama a função RPC que executa a lógica atômica de validação e criação de acesso
    const { data: result, error } = await context.supabase.rpc("accept_company_invitation", {
      _token_hash: data.token
    });

    if (error) throw error;
    return result;
  });

/**
 * Atualiza metadados da empresa.
 */
export const updateCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    empresaId: z.string().uuid(),
    settings: z.any()
  }))
  .handler(async ({ data, context }) => {
    await checkMembership(context.supabase, context.userId, data.empresaId, ["admin"]);

    const { error } = await context.supabase
      .from("empresas")
      .update({ configuracoes: data.settings })
      .eq("id", data.empresaId);

    if (error) throw error;
    return { success: true };
  });
