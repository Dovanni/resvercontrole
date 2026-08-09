import { describe, it, expect } from 'vitest';

describe('Stripe Webhook Contract - No Redirect', () => {
  const WEBHOOK_URL = 'http://localhost:8080/api/public/stripe/webhook';

  it('should return 400 instead of 302 for unsigned POST', async () => {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ test: true }),
    });
    
    // Expecting 400 (Bad Request) per contract, not 302 (Found)
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
  });

  it('should return 405 for GET method', async () => {
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET',
    });
    expect(response.status).toBe(405);
  });
});
