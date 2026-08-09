import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ status: 'allowed' }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }),
      POST: async () => new Response(JSON.stringify({ status: 'allowed post' }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      })
    }
  }
});
