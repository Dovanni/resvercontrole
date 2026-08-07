import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/diag-secret')({
  server: {
    handlers: {
      GET: async () => {
        const isPresent = !!process.env['TURNSTILE_SECRET_KEY'];
        return new Response(JSON.stringify({ secret_available: isPresent }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
})
