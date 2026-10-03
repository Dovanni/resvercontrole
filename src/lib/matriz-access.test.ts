import { describe, expect, it } from "vitest";
import { hasMatrizAccess } from "./matriz-access";

describe("Matriz authorization", () => {
  it("denies missing configuration and empty identities", () => {
    expect(hasMatrizAccess("tenant-admin", undefined)).toBe(false);
    expect(hasMatrizAccess("", "")).toBe(false);
  });
  it("requires an exact configured identity", () => {
    expect(hasMatrizAccess("owner", " owner, second-owner ")).toBe(true);
    expect(hasMatrizAccess("own", "owner")).toBe(false);
    expect(hasMatrizAccess("tenant-admin", "owner")).toBe(false);
  });
});
