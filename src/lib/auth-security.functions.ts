import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  verifyMathChallenge, 
  checkRateLimitPersistent,
  verifyTurnstile,
  clearRateLimitPersistent,
  recordRateLimitFailure
} from "./security.functions";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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

export const secureSignUp = createServerFn({ method: "POST" })
  .inputValidator((data) => signupSchema.parse(data))
  .handler(async ({ data }) => {
    const request = (globalThis as any).request as Request;
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
    const emailHash = data.email.toLowerCase().trim();
    
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

      // 3. Rate Limit (Contabiliza apenas tentativas estruturalmente válidas que passaram pelos desafios)
      const signupPolicy = { limit: 3, cooldowns: [5, 15, 30], windowMs: 60 * 60 * 1000 };
      const rateLimit = await recordRateLimitFailure('signup', data.email, signupPolicy);
      
      if (rateLimit.isBlocked) {
        throw new Error(JSON.stringify({
          code: "RATE_LIMITED",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          message: "Muitas tentativas de cadastro. Aguarde para tentar novamente."
        }));
      }
      
      // 4. Validações de duplicidade
      const { data: existingUser } = await supabaseAdmin.from('profiles' as any).select('id').eq('email', data.email).maybeSingle();
      if (existingUser) {
        throw new Error("Este e-mail já está em uso.");
      }
      
      return { success: true };
    } catch (error: any) {
      if (error.message?.includes("RATE_LIMITED")) {
        throw error;
      }
      const isInternalError = error.status >= 500 || error.message?.includes("configuração");
      if (isInternalError) {
        throw new Error("Erro interno temporário. Tente novamente em instantes.");
      }
      throw error;
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
