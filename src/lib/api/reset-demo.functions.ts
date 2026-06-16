import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem resetar os dados.");

    // Order matters: child tables first
    const tables = [
      "sale_items",
      "finance_entries",
      "receivables",
      "payables",
      "sales",
      "products",
      "customers",
      "suppliers",
    ] as const;

    for (const t of tables) {
      const { error } = await supabase.from(t as any).delete().eq("user_id", userId);
      if (error) throw new Error(`Erro ao limpar ${t}: ${error.message}`);
    }

    return { ok: true };
  });
