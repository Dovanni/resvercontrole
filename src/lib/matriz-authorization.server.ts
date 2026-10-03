import type { SupabaseClient } from "@supabase/supabase-js";
import { hasMatrizAccess } from "./matriz-access";

export async function requireMatrizIdentity(client: Pick<SupabaseClient, "auth">, userId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId || !hasMatrizAccess(userId, process.env.MATRIZ_ADMIN_USER_IDS)) {
    throw new Error("Acesso exclusivo aos responsáveis autorizados da Matriz.");
  }
}
