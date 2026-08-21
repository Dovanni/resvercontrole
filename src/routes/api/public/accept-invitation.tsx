import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/accept-invitation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const schema = z.object({
            token: z.string(),
          });

          const { token } = schema.parse(body);
          const authHeader = request.headers.get('authorization');

          if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const accessToken = authHeader.slice('Bearer '.length);
          const supabaseUrl = process.env.SUPABASE_URL;
          const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

          if (!supabaseUrl || !publishableKey) {
            throw new Error('Supabase server configuration is incomplete');
          }

          const supabase = createClient<Database>(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth: { persistSession: false, autoRefreshToken: false }
          });

          const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(accessToken);
          if (claimsError || !claimsData?.claims?.sub) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Chama a função RPC segura que lida com a lógica atômica de transação
          // e validação de expiração/uso do token.
          const { data, error } = await supabase.rpc('accept_company_invitation', {
            _token_hash: token
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
