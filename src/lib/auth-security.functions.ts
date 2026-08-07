import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  // verifyRecaptcha removido para migração Turnstile-Supabase 
  verifyMathChallenge, 
  checkRateLimit,
  verifyTurnstile
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
    // In TanStack Start, the request is available in the global context during server execution
    const request = (globalThis as any).request as Request;
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
    
    // 1. Rate Limit (Signup: 3 tentativas em 30 min por IP)
    const ipAllowed = await checkRateLimit(`signup:ip:${clientIp}`, 3, 30 * 60 * 1000);
    if (!ipAllowed) {
      throw new Error("Muitas tentativas de cadastro. Tente novamente mais tarde.");
    }
    
    // 2. Math Challenge (Sempre no cadastro)
    const mathValid = await verifyMathChallenge(data.mathChallengeToken, data.mathChallengeAnswer);
    if (!mathValid) {
      throw new Error("Desafio matemático incorreto ou expirado.");
    }
    
    // 3. Segurança (Turnstile - Application Layer SiteVerify)
    const turnstileValid = await verifyTurnstile(data.turnstileToken);
    if (!turnstileValid.success) {
      throw new Error("Verificação de segurança falhou. Por favor, tente novamente.");
    }
    
    // 4. Validações de duplicidade (CNPJ/Email)
    const { data: existingUser } = await supabaseAdmin.from('profiles' as any).select('id').eq('email', data.email).maybeSingle();
    if (existingUser) {
      // Proteção contra enumeração: Retornamos sucesso genérico ou erro genérico.
      // Mas no cadastro, o usuário precisa saber se o e-mail já existe.
      // O requisito diz: "Não revelar detalhes internos... manter mensagens úteis para erros locais".
      throw new Error("Este e-mail já está em uso.");
    }
    
    // 5. O Auth Signup REAL deve ser feito no CLIENTE para permitir a validação nativa do Turnstile pelo Supabase
    // e capturar a sessão corretamente. Esta server function valida apenas precondições de negócio e IP.
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
    const userAllowed = await checkRateLimit(`login:email:${emailHash}`, 5, 15 * 60 * 1000);
    if (!userAllowed) {
      throw new Error("Muitas tentativas de acesso. Tente novamente em 15 minutos.");
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
