import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasMatrizAccess } from "./matriz-access";

export const getMatrizAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Fetch current user to reject revoked/deleted identities, not just valid JWTs.
    const { data, error } = await context.supabase.auth.getUser();
    return { allowed: !error && data.user?.id === context.userId &&
      hasMatrizAccess(context.userId, process.env.MATRIZ_ADMIN_USER_IDS) };
  });

export const getMatrizPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ page: z.number().int().min(1).max(10000) }))
  .handler(async ({ context, data }) => {
    const { requireMatrizIdentity } = await import("./matriz-authorization.server");
    await requireMatrizIdentity(context.supabase, context.userId);
    // Privileged client is loaded only after server-side authorization.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const size = 50;
    const start = (data.page - 1) * size;
    const [users, companies, subscriptions] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: data.page, perPage: size }),
      supabaseAdmin.from("empresas").select("id,nome,razao_social,owner_id,status,created_at", { count: "exact" })
        .order("created_at", { ascending: false }).order("id").range(start, start + size - 1),
      supabaseAdmin.from("subscriptions").select("id,empresa_id,plan_id,status,source,last_payment_status,created_at,trial_ends_at,current_period_ends_at,cancel_at_period_end", { count: "exact" })
        .order("created_at", { ascending: false }).order("id").range(start, start + size - 1),
    ]);
    if (users.error || companies.error || subscriptions.error) {
      throw new Error("Não foi possível consultar o painel da Matriz. Tente novamente.");
    }
    const userIds = users.data.users.map((user) => user.id);
    const profiles = userIds.length ? await supabaseAdmin.from("profiles")
      .select("id,full_name").in("id", userIds) : { data: [], error: null };
    if (profiles.error) throw new Error("Não foi possível consultar os nomes dos cadastros.");
    const names = new Map(profiles.data?.map((profile) => [profile.id, profile.full_name]));
    return {
      page: data.page, pageSize: size, fetchedAt: new Date().toISOString(),
      users: users.data.users.map((user) => ({
        id: user.id, name: names.get(user.id) ?? null, email: user.email ?? null,
        createdAt: user.created_at, confirmedAt: user.email_confirmed_at ?? null,
      })),
      // Only selected administrative fields; never tokens or payment identifiers.
      companies: companies.data ?? [], subscriptions: subscriptions.data ?? [],
      totals: { users: "total" in users.data ? Number(users.data.total) : null,
        companies: companies.count, subscriptions: subscriptions.count },
      hasNext: users.data.users.length === size || (companies.count ?? 0) > start + size ||
        (subscriptions.count ?? 0) > start + size,
    };
  });
