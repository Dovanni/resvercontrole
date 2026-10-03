import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireMatrizIdentity } from "./matriz-authorization.server";

function client(id: string | null, error: unknown = null) {
  return { auth: { getUser: async () => ({ data: { user: id ? { id } : null }, error }) } } as unknown as Pick<SupabaseClient, "auth">;
}
describe("current Matriz identity", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rejects a tenant admin even with a valid authenticated identity", async () => {
    vi.stubEnv("MATRIZ_ADMIN_USER_IDS", "owner");
    await expect(requireMatrizIdentity(client("tenant-admin"), "tenant-admin")).rejects.toThrow("Acesso exclusivo");
  });
  it("rejects deleted, mismatched or invalid identities even if the JWT ID is listed", async () => {
    vi.stubEnv("MATRIZ_ADMIN_USER_IDS", "owner");
    for (const auth of [client(null), client("other"), client("owner", new Error("invalid"))]) {
      await expect(requireMatrizIdentity(auth, "owner")).rejects.toThrow("Acesso exclusivo");
    }
  });
  it("accepts the current identity only when explicitly configured", async () => {
    vi.stubEnv("MATRIZ_ADMIN_USER_IDS", "owner");
    await expect(requireMatrizIdentity(client("owner"), "owner")).resolves.toBeUndefined();
  });
});
