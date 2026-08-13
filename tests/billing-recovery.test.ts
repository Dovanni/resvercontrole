import { describe, it, expect, vi } from "vitest";
import { createStripeCheckoutSessionImpl } from "../src/lib/billing.server";
import { getStripeClient } from "../src/lib/stripe.server";
import * as supabaseClientServer from "../src/integrations/supabase/client.server";

// Mocking dependencies
vi.mock("../src/lib/stripe.server", () => ({
  getStripeClient: vi.fn(),
}));

vi.mock("../src/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn().mockReturnValue({
    headers: {
      get: vi.fn((name) => {
        if (name === "Authorization") return "Bearer mock-token";
        if (name === "host") return "localhost:8080";
        if (name === "origin") return "http://localhost:8080";
        return null;
      }),
    },
  }),
}));

describe("Billing Recovery Flow", () => {
  it("should trigger fail_checkout_attempt_initialization on pre-transport failure", async () => {
    const { supabaseAdmin } = supabaseClientServer;
    
    // 1. Mock Auth
    (supabaseAdmin.auth.getUser as any).mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    
    // 2. Mock Membership
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
    });

    // 3. Mock Subscription resolve
    // Need to reset mock to avoid pollution
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === "user_company_access") {
         return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
        };
      }
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "sub-123", stripe_customer_id: "cus-123" }, error: null }),
        };
      }
      return {};
    });

    // 4. Mock Reservation RPC
    const mockAttempt = { id: "attempt-123", status: "creating", updated_at: "2026-08-13T00:00:00Z" };
    (supabaseAdmin.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === "reserve_checkout_attempt") return { data: mockAttempt, error: null };
      if (fn === "fail_checkout_attempt_initialization") return { data: "failed", error: null };
      return { data: null, error: null };
    });

    // 5. Mock Stripe Client Failure (Pre-transport)
    (getStripeClient as any).mockImplementation(() => {
      const err = new Error("Stripe key mismatch");
      (err as any).__isStripeClientError = true;
      (err as any).reason_code = "STRIPE_CLIENT_KEY_MODE_MISMATCH";
      throw err;
    });

    // Execute
    try {
      await createStripeCheckoutSessionImpl("company-123", "trace-123");
    } catch (e) {
      // Expected failure
    }

    // Verify recovery RPC was called
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("fail_checkout_attempt_initialization", expect.objectContaining({
      p_attempt_id: "attempt-123",
      p_reason_code: "STRIPE_CLIENT_KEY_MODE_MISMATCH"
    }));
  });
});
