import { test, expect, vi } from 'vitest';

async function handleCheckoutResponse(response: Response, btn: HTMLButtonElement, originalText: string) {
  if (!response.ok) {
    const result = await response.json();
    console.error("Checkout session failed:", result);
    btn.disabled = false;
    btn.innerText = originalText;
    return;
  }

  const data = await response.json();
  
  // Validation Protocol
  const isValidUrl = typeof data.url === "string";
  const isHttps = isValidUrl && new URL(data.url).protocol === "https:";
  const isStripeHost = isValidUrl && new URL(data.url).hostname === "checkout.stripe.com";
  const isLiveSession = typeof data.sessionId === "string" && data.sessionId.startsWith("cs_live_");

  if (isValidUrl && isHttps && isStripeHost && isLiveSession) {
    window.location.assign(data.url);
  } else {
    console.error("Security validation failed for checkout redirect", {
      url: data.url,
      sessionId: data.sessionId
    });
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

test('valid 200 response with live URL calls location.assign once', async () => {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
    configurable: true
  });
  
  const btn = document.createElement('button');
  const data = { 
    url: 'https://checkout.stripe.com/pay/cs_live_123', 
    sessionId: 'cs_live_123' 
  };
  const resp = {
    ok: true,
    json: async () => data
  } as any;
  
  await handleCheckoutResponse(resp, btn, "Assinar");
  
  expect(assignSpy).toHaveBeenCalledWith(data.url);
  expect(assignSpy).toHaveBeenCalledTimes(1);
});

test('invalid URL protocol is rejected', async () => {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
    configurable: true
  });
  
  const btn = document.createElement('button');
  const data = { 
    url: 'http://checkout.stripe.com/pay/cs_live_123', 
    sessionId: 'cs_live_123' 
  };
  const resp = {
    ok: true,
    json: async () => data
  } as any;
  
  await handleCheckoutResponse(resp, btn, "Assinar");
  
  expect(assignSpy).not.toHaveBeenCalled();
});

test('invalid host is rejected', async () => {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
    configurable: true
  });
  
  const btn = document.createElement('button');
  const data = { 
    url: 'https://evil.com/pay/cs_live_123', 
    sessionId: 'cs_live_123' 
  };
  const resp = {
    ok: true,
    json: async () => data
  } as any;
  
  await handleCheckoutResponse(resp, btn, "Assinar");
  
  expect(assignSpy).not.toHaveBeenCalled();
});

test('sandbox session in production check is rejected', async () => {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
    configurable: true
  });
  
  const btn = document.createElement('button');
  const data = { 
    url: 'https://checkout.stripe.com/pay/cs_test_123', 
    sessionId: 'cs_test_123' 
  };
  const resp = {
    ok: true,
    json: async () => data
  } as any;
  
  await handleCheckoutResponse(resp, btn, "Assinar");
  
  expect(assignSpy).not.toHaveBeenCalled();
});

test('HTTP error never redirects', async () => {
  const assignSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
    configurable: true
  });
  
  const btn = document.createElement('button');
  const resp = {
    ok: false,
    json: async () => ({ error: 'failed' })
  } as any;
  
  await handleCheckoutResponse(resp, btn, "Assinar");
  
  expect(assignSpy).not.toHaveBeenCalled();
  expect(btn.disabled).toBe(false);
});
