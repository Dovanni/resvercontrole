import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkRateLimit } from "./security.functions";

const onboardingSchema = z.object({
  empresa: z.object({
    nome: z.string().min(1),
    razao_social: z.string().optional(),
    nome_fantasia: z.string().optional(),
    documento: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/, "CNPJ inválido"),
    telefone: z.string().optional(),
  }),
  consentimentos: z.object({
    termos_uso: z.boolean().refine(v => v === true, "Aceite obrigatório"),
    politica_privacidade: z.boolean().refine(v => v === true, "Aceite obrigatório"),
    versao: z.string(),
  }),
});

export const completeCompanyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => onboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const request = (globalThis as any).request as Request;
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';

    // Anti-bot/Rate limit para onboarding
    const allowed = await checkRateLimit(`onboarding:user:${userId}`, 5, 60 * 60 * 1000);
    if (!allowed) throw new Error("Muitas tentativas de configuração. Aguarde.");

    // 1. Verificar se já possui empresa (idempotência)
    const { data: existing } = await supabaseAdmin
      .from("user_company_access")
      .select("empresa_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { success: true, empresa_id: existing.empresa_id, already_onboarded: true };
    }

    // 2. Criar Empresa
    const { data: empresa, error: empError } = await supabaseAdmin
      .from("empresas")
      .insert({
        nome: data.empresa.nome,
        documento: data.empresa.documento,
        owner_id: userId,
        status: 'active'
      })
      .select("id")
      .single();

    if (empError) throw new Error(`Erro ao criar empresa: ${empError.message}`);

    // 3. Criar Membership Admin
    const { error: accessError } = await supabaseAdmin
      .from("user_company_access")
      .insert({
        user_id: userId,
        empresa_id: empresa.id,
        role: 'admin',
        status: 'active'
      });

    if (accessError) throw new Error(`Erro ao vincular administrador: ${accessError.message}`);

    // 4. Registrar Consentimento (Audit Log simplificado na própria tabela de empresas ou logs se existir)
    // Por ora, apenas registramos que o onboarding foi concluído com sucesso.
    
    return { success: true, empresa_id: empresa.id };
  });
