import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Route } from '../_authenticated.configuracoes.assinatura';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock hook contexts
vi.mock('@/hooks/use-subscription-context', () => ({
  useSubscriptionContext: vi.fn(() => ({
    data: {
      plan_code: 'essencial',
      plan_name: 'Plano Essencial',
      status: 'trialing',
      days_remaining: 29,
      current_user_count: 1,
      max_users: 5,
      current_period_ends_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    },
    isLoading: false
  }))
}));

vi.mock('@/hooks/use-multiempresa', () => ({
  useMultiempresa: vi.fn(() => ({
    empresaId: 'f958365e-3951-46e6-8595-e4f111115a90'
  }))
}));

// Mock server functions to ensure no calls during render
vi.mock('@/lib/billing.functions', () => ({
  createStripeCheckoutSession: vi.fn(),
  getCompanySubscriptionContext: vi.fn()
}));

const queryClient = new QueryClient();

describe('SubscriptionPage UX Copy Audit', () => {
  it('displays correct truthful copy when checkout is cancelled', () => {
    // Force search params to contain checkout=cancel
    delete (window as any).location;
    (window as any).location = new URL('https://localhost:8080/configuracoes/assinatura?checkout=cancel');

    const Component = Route.options.component!;
    render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>
    );

    // Texto não contém “sessão encerrada”
    const alertBody = screen.getByText(/Você saiu do checkout/i);
    expect(alertBody.textContent).not.toContain('sessão de checkout foi encerrada');
    expect(alertBody.textContent).not.toContain('encerrada');

    // Texto contém “Nenhum pagamento foi realizado”
    expect(alertBody.textContent).toContain('Nenhum pagamento foi realizado');

    // Texto contém “avaliação gratuita continua normalmente”
    expect(alertBody.textContent).toContain('avaliação gratuita continua normalmente');

    // Título correto
    expect(screen.getByText('Checkout interrompido')).toBeDefined();

    // CTA permanece “Retomar checkout seguro — R$ 35,90/mês”
    const cta = screen.getByRole('button', { name: /Retomar checkout seguro — R$ 35,90\/mês/i });
    expect(cta).toBeDefined();
  });
});
