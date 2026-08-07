import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyRecaptcha, checkRateLimit } from "./security.functions";

const recoverySchema = z.object({
  email: z.string().email(),
  recaptchaToken: z.string(),
});

export const secureRequestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data) => recoverySchema.parse(data))
  .handler(async ({ data }) => {
    const request = (globalThis as any).request as Request;
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
    const emailHash = data.email.toLowerCase().trim();

    // 1. Rate Limit (Recuperação: 3 solicitações por hora por identidade)
    const allowed = await checkRateLimit(`recovery:email:${emailHash}`, 3, 60 * 60 * 1000);
    if (!allowed) {
      // Mesmo bloqueado, retornamos "sucesso" genérico para evitar enumeração
      return { success: true, message: "Se existir uma conta com esse e-mail, enviaremos as orientações." };
    }

    // 2. reCAPTCHA
    try {
      const recaptcha = await verifyRecaptcha(data.recaptchaToken);
      if (!recaptcha.success) {
        throw new Error("Falha na verificação de segurança.");
      }
    } catch (e: any) {
      if (e.message === "RECAPTCHA_CONFIGURATION_REQUIRED") {
        throw new Error("RECAPTCHA_CONFIGURATION_REQUIRED");
      }
      throw e;
    }

    // A chamada real ao Supabase Auth é feita pelo cliente. 
    // Esta função valida se o pedido é legítimo e não automatizado.
    return { success: true };
  });
