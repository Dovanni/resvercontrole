import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/simple-test')({
  server: {
    handlers: {
      GET: async () => {
        return new Response('OK', { status: 200 });
      },
      POST: async () => {
        return new Response('Created', { status: 201 });
      }
    }
  }
});
