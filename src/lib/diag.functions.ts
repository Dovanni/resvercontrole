import { createServerFn } from "@tanstack/react-start";

export const checkEnvVars = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      STRIPE_RESTRICTED_KEY: !!process.env['STRIPE_RESTRICTED_KEY'],
      STRIPE_WEBHOOK_SECRET: !!process.env['STRIPE_WEBHOOK_SECRET'],
      SUPABASE_SERVICE_ROLE_KEY: !!process.env['SUPABASE_SERVICE_ROLE_KEY'],
      VITE_SUPABASE_URL: !!process.env['VITE_SUPABASE_URL'],
      STRIPE_PRICE_ENTERPRISE_MONTHLY: !!process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'],
    };
  });
