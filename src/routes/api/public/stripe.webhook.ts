import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => new Response('Method Not Allowed', { status: 405 }),
      POST: async ({ request }) => {
        try {
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response('Error', { status: 500 });
        }
      }
    }
  }
});
