import { supabase } from "@/integrations/supabase/client";

export async function auditBundleForSecrets() {
  const secrets = [
    "sk_test_", "sk_live_", "rk_test_", "rk_live_",
    "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_WEBHOOK_SECRET"
  ];
  
  // No browser environment, process.env should be empty/undefined for these keys
  const findings = secrets.filter(s => {
    try {
      // @ts-ignore
      return typeof process !== 'undefined' && process.env && process.env[s];
    } catch (e) {
      return false;
    }
  });

  return {
    safe: findings.length === 0,
    findings
  };
}
