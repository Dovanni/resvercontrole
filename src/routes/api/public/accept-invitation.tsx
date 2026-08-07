import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/accept-invitation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const schema = z.object({
            token: z.string(),
            userId: z.string().uuid(),
          });

          const { token, userId } = schema.parse(body);

          // Chama a função RPC segura que lida com a lógica atômica de transação
          // e validação de expiração/uso do token.
          const { data, error } = await supabase.rpc('accept_company_invitation', {
            _token_hash: token,
            _user_id: userId
          });

          if (error) {
            console.error('Erro ao aceitar convite:', error);
            return new Response(JSON.stringify({ error: error.message }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ success: true, data }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
