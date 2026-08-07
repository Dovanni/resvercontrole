import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/api/public/rpc-test')({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          // 1. Diagnóstico do owner (legacy)
          const { data: bankAccounts } = await supabase.from('bank_accounts').select('user_id').limit(1);
          const legacy_owner = bankAccounts?.[0]?.user_id;

          // 2. Contagens reais
          const { count: company_count } = await supabase.from('empresas').select('*', { count: 'exact', head: true });
          const { count: membership_count } = await supabase.from('user_company_access').select('*', { count: 'exact', head: true });
          
          // 3. Verificar meu contexto
          const my_id = user?.id;
          const { data: my_memberships } = my_id ? await supabase.from('user_company_access').select('*').eq('user_id', my_id) : { data: null };
          
          return new Response(JSON.stringify({
            auth_user: my_id,
            legacy_owner,
            company_count,
            membership_count,
            my_memberships
          }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }
  }
})
