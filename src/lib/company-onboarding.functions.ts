import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { normalizeCnpj, validateCnpj as validateCnpjCheck } from "@/lib/cnpj-validator";
import {
  checkRateLimitPersistent,
  recordRateLimitFailure,
  verifyMathChallenge,
  verifyTurnstile,
} from "@/lib/security.functions";

const onboardingSchema = z.object({
  nomeAdmin: z.string().trim().min(2).max(160),
  empresaNome: z.string().trim().min(2).max(200),
  razaoSocial: z.string().trim().min(2).max(240),
  email: z.string().trim().email().max(320),
  cnpj: z.string().min(1).max(32),
  turnstileToken: z.string().min(1),
  mathToken: z.string().min(1),
  mathAnswer: z.string().min(1).max(32),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
});

const SIGNUP_POLICY = {
  limit: 3,
  cooldowns: [5, 15, 30],
  windowMs: 60 * 60 * 1000,
};

function hashOnboardingIdentity(email: string): string {
  const secret = process.env["RATE_LIMIT_HMAC_SECRET"];
  if (!secret) {
    throw new Error("Configuração de segurança indisponível.");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

function getCanonicalInviteRedirectUrl(): string {
  const configured = process.env["SITE_URL"]?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        url.hostname === "vejamais.com.br" ||
        url.hostname === "www.vejamais.com.br" ||
        url.hostname.endsWith(".vejamais.workers.dev") ||
        url.hostname.endsWith(".lovable.app") ||
        url.hostname === "localhost"
      ) {
        return `${url.origin}/auth/callback`;
      }
    } catch {
      // Fall through to the canonical production origin.
    }
  }

  return "https://vejamais.com.br/auth/callback";
}

async function recordSignupSecurityFailure(email: string) {
  try {
    return await recordRateLimitFailure("signup", email, SIGNUP_POLICY);
  } catch (error) {
    console.error("[VCRL-G2.33] Failed to persist signup security failure [sanitized]", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return { isBlocked: false, retryAfterSeconds: 0 };
  }
}

async function findAuthUserIdByEmail(
  supabaseAdmin: any,
  normalizedEmail: string,
): Promise<string | null> {
  const perPage = 100;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data?.users?.find(
      (user: any) => user.email?.toLowerCase().trim() === normalizedEmail,
    );
    if (found?.id) return found.id;

    if (!data?.users || data.users.length < perPage) break;
  }

  return null;
}

function isAlreadyRegisteredInviteError(error: any): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  );
}

export const createCompanyOnboarding = createServerFn({ method: "POST" })
  .inputValidator((data) => onboardingSchema.parse(data))
  .handler(async ({ data }) => {
    const traceId = crypto.randomUUID();
    const normalizedEmail = data.email.toLowerCase().trim();
    const normalizedCnpj = normalizeCnpj(data.cnpj);

    if (!validateCnpjCheck(normalizedCnpj)) {
      throw new Error("CNPJ inválido. Valide novamente antes de continuar.");
    }

    if (!process.env["RECAPTCHA_SECRET_KEY"] || !process.env["TURNSTILE_SECRET_KEY"]) {
      console.error("[VCRL-G2.33] Missing signup security secret", { trace_id: traceId });
      throw new Error("Configuração de segurança indisponível. Tente novamente em instantes.");
    }

    const rateStatus = await checkRateLimitPersistent("signup", normalizedEmail);
    if (!rateStatus.allowed) {
      throw new Error(
        JSON.stringify({
          code: "RATE_LIMITED",
          retryAfter: rateStatus.retryAfterSeconds,
          message: "Muitas tentativas de cadastro. Aguarde para tentar novamente.",
        }),
      );
    }

    const mathValid = await verifyMathChallenge(data.mathToken, data.mathAnswer);
    if (!mathValid) {
      const failure = await recordSignupSecurityFailure(normalizedEmail);
      throw new Error(
        JSON.stringify({
          code: failure.isBlocked ? "RATE_LIMITED" : "MATH_CHALLENGE_INVALID",
          retryAfter: failure.retryAfterSeconds || undefined,
          message: "Desafio matemático incorreto ou expirado.",
        }),
      );
    }

    const turnstileValid = await verifyTurnstile(data.turnstileToken);
    if (!turnstileValid.success) {
      const failure = await recordSignupSecurityFailure(normalizedEmail);
      throw new Error(
        JSON.stringify({
          code: failure.isBlocked ? "RATE_LIMITED" : "TURNSTILE_INVALID",
          retryAfter: failure.retryAfterSeconds || undefined,
          message: "Verificação de segurança falhou. Por favor, tente novamente.",
        }),
      );
    }

    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin() as any;
    const identityEmailHash = hashOnboardingIdentity(normalizedEmail);

    const { data: existingCompany, error: companyLookupError } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("documento", normalizedCnpj)
      .maybeSingle();

    if (companyLookupError) {
      console.error("[VCRL-G2.33] Company duplicate lookup failed [sanitized]", {
        trace_id: traceId,
        code: companyLookupError.code,
      });
      throw new Error("Não foi possível confirmar a disponibilidade da empresa.");
    }

    if (existingCompany) {
      throw new Error("Esta empresa já possui cadastro na VEJAMAIS ERP.");
    }

    const { data: onboardingId, error: onboardingError } = await supabaseAdmin.rpc(
      "create_pending_onboarding",
      {
        p_nome_admin: data.nomeAdmin.trim(),
        p_nome_empresa: data.empresaNome.trim(),
        p_cnpj_formatado: data.cnpj.trim(),
        p_cnpj_limpo: normalizedCnpj,
        p_email_hash: identityEmailHash,
        p_terms_version: "1.0",
        p_privacy_version: "1.0",
        p_expires_in_hours: 24,
      },
    );

    if (onboardingError || !onboardingId) {
      console.error("[VCRL-G2.33] Pending onboarding reservation failed [sanitized]", {
        trace_id: traceId,
        code: onboardingError?.code,
      });
      throw new Error("Não foi possível preparar o cadastro da empresa.");
    }

    let authUserId: string | null = null;
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: getCanonicalInviteRedirectUrl(),
        data: {
          onboarding_id: onboardingId,
          onboarding_kind: "public_company_signup",
        },
      },
    );

    if (inviteError) {
      if (!isAlreadyRegisteredInviteError(inviteError)) {
        console.error("[VCRL-G2.33] Supabase invite failed [sanitized]", {
          trace_id: traceId,
          status: inviteError.status,
        });
        throw new Error("Não foi possível enviar o convite de ativação. Tente novamente em instantes.");
      }

      authUserId = await findAuthUserIdByEmail(supabaseAdmin, normalizedEmail);
      if (!authUserId) {
        console.error("[VCRL-G2.33] Existing auth user could not be reconciled [sanitized]", {
          trace_id: traceId,
        });
        throw new Error("A conta já existe, mas não foi possível vinculá-la ao cadastro. Tente entrar novamente.");
      }
    } else {
      authUserId = inviteData?.user?.id ?? null;
    }

    if (!authUserId) {
      throw new Error("O convite foi criado sem uma identidade de usuário válida.");
    }

    const { error: linkError } = await supabaseAdmin.rpc("link_auth_user_to_onboarding", {
      p_onboarding_id: onboardingId,
      p_auth_user_id: authUserId,
    });

    if (linkError) {
      console.error("[VCRL-G2.33] Auth/onboarding link failed [sanitized]", {
        trace_id: traceId,
        code: linkError.code,
      });
      throw new Error("O convite foi criado, mas a ativação ainda não pôde ser vinculada. Tente novamente.");
    }

    return {
      success: true,
      next_steps: inviteError ? "LOGIN_AND_ACTIVATE" : "CHECK_EMAIL_AND_ACTIVATE",
      message: inviteError
        ? "Conta localizada. Entre com seu e-mail para concluir a ativação da empresa."
        : "Enviamos um e-mail de confirmação para concluir a ativação da empresa.",
      trace_id: traceId,
    };
  });
