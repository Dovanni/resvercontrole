import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Route } from '../_authenticated.configuracoes.assinatura';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      search: '?checkout=cancel',
      hostname: 'localhost',
      origin: 'http://localhost:8080'
    } as any;

    const Component = Route.options.component!;
    render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>
    );

    // Título correto
    expect(screen.getByText('Checkout interrompido')).toBeTruthy();

    // Texto não contém “sessão encerrada”
    // Buscamos o parágrafo que contém a mensagem
    const alertBody = screen.getByText(/Você saiu do checkout antes de concluir/i);
    expect(alertBody.textContent).not.toContain('sessão de checkout foi encerrada');
    expect(alertBody.textContent).not.toContain('encerrada.');

    // Texto contém “Nenhum pagamento foi realizado”
    expect(alertBody.textContent).toContain('Nenhum pagamento foi realizado');

    // Texto contém “avaliação gratuita continua normalmente”
    expect(alertBody.textContent).toContain('avaliação gratuita continua normalmente');

    // CTA permanece “Retomar checkout seguro — R$ 35,90/mês”
    // Note: The CTA content depends on isCtaEnabled which checks hostname/origin.
    // In test it might be disabled but the text should still match if checkout=cancel.
    const cta = screen.getByText(/Retomar checkout seguro — R$ 35,90\/mês/i);
    expect(cta).toBeTruthy();

    // Reset location
    window.location = originalLocation;
  });
});
