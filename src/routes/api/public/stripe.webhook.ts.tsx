import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/stripe/webhook/ts')({
  loader: async () => {
    // Force direct response from loader for API compatibility in dev
    console.log('[DEBUG WEBHOOK] Loader triggered');
    return new Response('Method Not Allowed', { status: 405 });
  }
});
