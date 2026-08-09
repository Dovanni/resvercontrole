import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook')({
  server: {
    handlers: {
      GET: async () => {
        console.log('[DEBUG WEBHOOK] GET probe');
        return new Response('Method Not Allowed', { status: 405 });
      },
      POST: async ({ request }) => {
        console.log('[DEBUG WEBHOOK] POST request');
        return new Response('Bad Request', { status: 400 });
      }
    }
  }
});
