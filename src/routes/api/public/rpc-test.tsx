import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/api/public/rpc-test')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ status: 'rpc-test ok' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      },
      POST: async () => {
        return new Response(JSON.stringify({ status: 'rpc-test post ok' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
});

