import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  verifyMathChallenge, 
  checkRateLimit,
  verifyTurnstile,
  clearRateLimit
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
    const rateLimitKey = `signup:ip:${clientIp}`;
    
    try {
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
      const rateLimit = await checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000); // 3 tentativas, inicial 5min
      if (!rateLimit.allowed) {
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
      // Se for um erro do Zod ou erro de código que não atingiu a camada de segurança real,
      // não contabilizamos no rate limit (o checkRateLimit acima já é condicional).
      // Mas se o erro for de negócio APÓS o checkRateLimit, ele conta.
      
      // Se for o erro de RATE_LIMITED, apenas repassamos
      if (error.message?.includes("RATE_LIMITED")) {
        throw error;
      }

      // Erros internos ou falhas de configuração não devem punir o usuário
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
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
    await clearRateLimit(`signup:ip:${clientIp}`);
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
    
    // 1. Rate Limit (Login: 5 tentativas em 15 min por identidade)
    const rateLimit = await checkRateLimit(`login:email:${emailHash}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      throw new Error(JSON.stringify({
        code: "RATE_LIMITED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        message: "Muitas tentativas de acesso. Aguarde para tentar novamente."
      }));
    }
    
    // 2. Math Challenge (Sempre no login conforme requisito VMEAP)
    const mathValid = await verifyMathChallenge(data.mathChallengeToken, data.mathChallengeAnswer);
    if (!mathValid) {
      throw new Error("Desafio matemático incorreto ou expirado.");
    }

    // 3. Segurança (Turnstile - Application Layer SiteVerify) - Chamado APÓS o math challenge
    const turnstileValid = await verifyTurnstile(data.turnstileToken);
    if (!turnstileValid.success) {
      throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
    }
    
    // 4. Se chegou aqui, as precondições passaram.
    // O Auth REAL deve ser feito no CLIENTE.
    return { 
      success: true 
    };
  });
