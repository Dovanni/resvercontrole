import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";

export const checkResetPasswordContext = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const supabaseAdmin = getSupabaseAdmin();
    
    if (!userId) {
      return { 
        allowed: false, 
        reason: "Sessão não identificada. Por favor, utilize o link enviado para o seu e-mail." 
      };
    }

    try {
      // Verificar se existe um onboarding pendente para este usuário
      const { data: onboarding, error } = await supabaseAdmin
        .from('pending_onboardings' as any)
        .select('id, status')
        .eq('auth_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;

      // Se não houver onboarding pendente, mas houver sessão, 
      // verificamos se o usuário já é um administrador principal de alguma empresa
      // para permitir o reset de senha comum.
      if (!onboarding) {
        const { data: membership } = await supabaseAdmin
          .from('user_company_access' as any)
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (!membership) {
          return { 
            allowed: false,
            reason: "Conta em estado inválido ou convite expirado." 
          };
        }
      }

      return { 
        allowed: true,
        hasPending: !!onboarding
      };
    } catch (error) {
      console.error("Erro ao validar contexto de reset-password:", error);
      return { 
        allowed: false,
        reason: "Erro ao validar sua solicitação. Tente novamente." 
      };
    }
  });
