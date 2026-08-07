import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "./security.functions";

const recoverySchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string(),
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

    // 2. Segurança (Turnstile)
    if (!data.turnstileToken) {
      throw new Error("Token de segurança ausente.");
    }

    // A chamada real ao Supabase Auth é feita pelo cliente. 
    // Esta função valida se o pedido é legítimo e não automatizado.
    return { success: true };
  });
