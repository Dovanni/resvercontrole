import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  verifyMathChallenge, 
  checkRateLimitPersistent,
  verifyTurnstile,
  clearRateLimitPersistent,
  recordRateLimitFailure,
  checkRateLimit
} from "./security.functions";
import crypto from "crypto";

const recoverySchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string(),
});

export const secureRequestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data) => recoverySchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const emailHash = email;

    try {
      // 1. Rate Limit
      const allowed = await checkRateLimit(`recovery:email:${emailHash}`, 3, 60 * 60 * 1000);
      // Proteção contra enumeração: sempre retornar sucesso aparente
      const genericResponse = { success: true, message: "Se o endereço estiver cadastrado, enviaremos as orientações para redefinição da senha." };
      
      if (!allowed) return genericResponse;

      // 2. Segurança (Turnstile)
      const turnstileValid = await verifyTurnstile(data.turnstileToken);
      if (!turnstileValid.success) {
        throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
      }

      // 3. Gerar link de recuperação via Supabase Admin (Server-Only)
      // Não utilizamos resetPasswordForEmail para evitar envio automático do Supabase
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });

      // Erro ou usuário não encontrado
      if (linkError || !linkData.properties?.hashed_token) {
        // Log sanitizado sem e-mail ou token
        if (linkError) console.error("GenerateLink recovery error [sanitized]");
        return genericResponse;
      }

      // 4. Construir link controlado da aplicação
      const token = linkData.properties.hashed_token;
      const baseUrl = getInviteRedirectUrl('recovery').split('/auth/callback/recovery')[0];
      const recoveryLink = `${baseUrl}/auth/callback/recovery?token_hash=${token}&type=recovery`;

      // 5. Enviar e-mail via Hostinger SMTP (Server-Only)
      const { sendMail } = await import("./email.server");
      const { getRecoveryEmailTemplate } = await import("./email-templates.server");

      await sendMail({
        to: email,
        subject: "Redefina sua senha de acesso à VEJAMAIS",
        html: getRecoveryEmailTemplate(recoveryLink),
      });

      return genericResponse;
    } catch (error: any) {
      // Falhas técnicas não devem revelar existência da conta
      console.error("Recovery process failure [sanitized]");
      return { success: true, message: "Se o endereço estiver cadastrado, enviaremos as orientações para redefinição da senha." };
    }
  });


const signupSchema = z.object({
  email: z.string().email(),
  empresaNome: z.string().min(1),
  cnpj: z.string().optional(),
  nomeAdmin: z.string().min(1),
  turnstileToken: z.string(),
  mathChallengeToken: z.string(),
  mathChallengeAnswer: z.string(),
  consent: z.object({
    termos: z.boolean().refine(v => v === true),
    privacidade: z.boolean().refine(v => v === true),
  })
});

/**
 * Gera HMAC-SHA256 para o e-mail (usado para busca segura no pending_onboardings).
 */
/**
 * Resolve a URL de redirecionamento do convite baseada no ambiente.
 */
export function getInviteRedirectUrl(type: 'invite' | 'recovery' = 'invite') {
  const siteUrl = process.env['SITE_URL'];
  const previewId = "c1cf42e3-5ea4-4a1b-a6cc-454256b65835";
  
  // Rota de callback dedicada dependendo do tipo
  const path = type === 'recovery' ? "/auth/callback/recovery" : "/auth/callback";

  if (siteUrl?.includes("lovable.app")) {
    if (siteUrl.includes(previewId)) {
      return `https://id-preview--${previewId}.lovable.app${path}`;
    }
    return `${siteUrl}${path}`;
  }

  if (siteUrl) {
    return `${siteUrl}${path}`;
  }

  return `http://localhost:8080${path}`;
}

function hashEmail(email: string) {
  const secret = process.env['RATE_LIMIT_HMAC_SECRET'];
  if (!secret) throw new Error("RATE_LIMIT_HMAC_SECRET não configurado.");
  return crypto.createHmac('sha256', secret)
    .update(email.toLowerCase().trim())
    .digest('hex');
}

export const secureSignUp = createServerFn({ method: "POST" })
  .inputValidator((data) => signupSchema.parse(data))
  .handler(async ({ data }) => {
    const emailHash = data.email.toLowerCase().trim();
    const identityEmailHash = hashEmail(data.email);
    let onboardingId: string | null = null;
    let authUserId: string | null = null;
    
    try {
      // 0. Pré-check Rate Limit (Persistente)
      const rateCheck = await checkRateLimitPersistent('signup', emailHash);
      if (!rateCheck.allowed) {
        throw new Error(JSON.stringify({
          code: "RATE_LIMITED",
          retryAfterSeconds: rateCheck.retryAfterSeconds,
          message: "Muitas tentativas de cadastro. Aguarde para tentar novamente."
        }));
      }

      // 1. Math Challenge
      const mathValid = await verifyMathChallenge(data.mathChallengeToken, data.mathChallengeAnswer);
      if (!mathValid) {
        throw new Error("Desafio matemático incorreto ou expirado.");
      }
      
      // 2. Segurança (Turnstile)
      const turnstileValid = await verifyTurnstile(data.turnstileToken);
      if (!turnstileValid.success) {
        throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
      }

      // 3. Rate Limit (Contabiliza)
      const signupPolicy = { limit: 3, cooldowns: [5, 15, 30], windowMs: 60 * 60 * 1000 };
      const rateLimit = await recordRateLimitFailure('signup', data.email, signupPolicy);
      
      if (rateLimit.isBlocked) {
        throw new Error(JSON.stringify({
          code: "RATE_LIMITED",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          message: "Muitas tentativas de cadastro. Aguarde para tentar novamente."
        }));
      }
      
      // 4. Validação de duplicidade (Auth e Perfis)
      const { data: existingUser } = await supabaseAdmin.from('profiles' as any).select('id').eq('email', data.email).maybeSingle();
      if (existingUser) {
        // Silenciosamente retornar sucesso para evitar enumeração, mas não enviar e-mail
        return { success: true, message: "Se os dados estiverem aptos, enviaremos as orientações de ativação para o e-mail informado." };
      }

      // 5. Reserva idempotente de Onboarding
      const { data: newOnboardingId, error: onboardingError } = await (supabaseAdmin.rpc as any)('create_pending_onboarding', {
        p_nome_admin: data.nomeAdmin,
        p_nome_empresa: data.empresaNome,
        p_cnpj_formatado: data.cnpj || null,
        p_cnpj_limpo: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
        p_email_hash: identityEmailHash,
        p_terms_version: "1.0",
        p_privacy_version: "1.0"
      });

      if (onboardingError) throw onboardingError;
      onboardingId = newOnboardingId;

      // 6. Invite User (Server-Only)
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: getInviteRedirectUrl('invite'),
        data: {
          onboarding_id: onboardingId
        }
      });

      if (inviteError) {
        // Se falhou o convite, remover a reserva (Compensação)
        if (onboardingId) {
          await supabaseAdmin.rpc('cancel_pending_onboarding', { p_onboarding_id: onboardingId });
        }
        throw inviteError;
      }
      
      authUserId = inviteData.user.id;

      // 7. Vincular Auth User ID à reserva
      const { error: linkError } = await (supabaseAdmin.rpc as any)('link_auth_user_to_onboarding', {
        p_onboarding_id: onboardingId,
        p_auth_user_id: authUserId
      });

      if (linkError) {
        // Compensação crítica: deletar usuário e cancelar reserva
        await supabaseAdmin.auth.admin.deleteUser(authUserId as string);
        await (supabaseAdmin.rpc as any)('cancel_pending_onboarding', { p_onboarding_id: onboardingId });
        throw linkError;
      }
      
      return { 
        success: true, 
        message: "Se os dados estiverem aptos, enviaremos as orientações de ativação para o e-mail informado." 
      };
    } catch (error: any) {
      if (error.message?.includes("RATE_LIMITED")) {
        throw error;
      }
      const isInternalError = error.status >= 500 || error.message?.includes("configuração") || error.message?.includes("SMTP");
      if (isInternalError) {
        throw new Error("Erro interno temporário. Tente novamente em instantes.");
      }
      throw error;
    }
  });

export const finalizeOnboarding = createServerFn({ method: "POST" })
  .handler(async ({ context }) => {
    // 1. Obter usuário autenticado (TanStack Start context injetado pelo middleware)
    const { supabase: userClient, userId } = context as any;
    if (!userId) throw new Error("Não autorizado");

    try {
      // 2. Executar RPC transacional para criar empresa e perfis
      // A autoridade de qual onboarding finalizar reside no userId validado pelo middleware
      const { data: result, error: rpcError } = await (supabaseAdmin.rpc as any)('finalize_user_onboarding', {
        p_auth_user_id: userId
      });

      if (rpcError) throw rpcError;

      // 3. Opcional: Limpar metadados informais (não-autoritativos) se existirem
      await supabaseAdmin.auth.admin.updateUserById(userId, { 
        user_metadata: { onboarding_completed: true } 
      });

      return { success: true };
    } catch (error: any) {
      console.error("Erro na finalização do onboarding:", error);
      throw new Error(error.message || "Falha ao concluir a criação da empresa.");
    }
  });

export const completeSignUpSuccess = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const request = (globalThis as any).request as Request;
    await clearRateLimitPersistent('signup', data.email);
    return { success: true };
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  turnstileToken: z.string(),
  mathChallengeToken: z.string(),
  mathChallengeAnswer: z.string(),
});

export const secureSignIn = createServerFn({ method: "POST" })
  .inputValidator((data) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const request = (globalThis as any).request as Request;
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
    const emailHash = data.email.toLowerCase().trim();
    
    try {
      // 0. Pré-check Rate Limit (Persistente)
      const rateCheck = await checkRateLimitPersistent('login', emailHash);
      if (!rateCheck.allowed) {
        throw new Error(JSON.stringify({
          code: "RATE_LIMITED",
          retryAfterSeconds: rateCheck.retryAfterSeconds,
          message: "Muitas tentativas de acesso. Aguarde para tentar novamente."
        }));
      }

      // 1. Math Challenge
      const mathValid = await verifyMathChallenge(data.mathChallengeToken, data.mathChallengeAnswer);
      if (!mathValid) {
        throw new Error("Desafio matemático incorreto ou expirado.");
      }

      // 2. Segurança (Turnstile)
      const turnstileValid = await verifyTurnstile(data.turnstileToken);
      if (!turnstileValid.success) {
        throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
      }
      
      // 3. Rate Limit (Login: 5 tentativas, inicial 15min - Progressivo)
      const loginPolicy = { limit: 5, cooldowns: [15, 30, 60], windowMs: 60 * 60 * 1000 };
      const rateLimit = await recordRateLimitFailure('login', data.email, loginPolicy);
      
      if (rateLimit.isBlocked) {
        throw new Error(JSON.stringify({
          code: "RATE_LIMITED",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          message: "Muitas tentativas de acesso. Aguarde para tentar novamente."
        }));
      }
      
      return { success: true };
    } catch (error: any) {
      if (error.message?.includes("RATE_LIMITED")) {
        throw error;
      }
      throw error;
    }
  });

export const completeSignInSuccess = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const emailHash = data.email.toLowerCase().trim();
    await clearRateLimitPersistent('login', data.email);
    return { success: true };
  });
