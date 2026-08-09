/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock components to avoid deep tree issues
vi.mock('@/components/app-shell', () => ({
  PageHeader: ({ title, subtitle }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}));
vi.mock('lucide-react', () => ({
  Check: () => <span>Check</span>,
  CreditCard: () => <span>CreditCard</span>,
  Users: () => <span>Users</span>,
  Clock: () => <span>Clock</span>,
  AlertCircle: () => <span>AlertCircle</span>,
}));

// Partial mock for @tanstack/react-router
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createFileRoute: () => () => ({
      options: { component: () => null }
    }),
    Link: ({ children }: any) => <a>{children}</a>
  };
});

// Mock hooks
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

vi.mock('@/lib/billing.functions', () => ({
  createStripeCheckoutSession: vi.fn(),
  getCompanySubscriptionContext: vi.fn()
}));

// Import component directly
import { SubscriptionSettingsPage } from '../../routes/_authenticated.configuracoes.assinatura';

const queryClient = new QueryClient();

describe('SubscriptionPage UX Copy Audit', () => {
  it('displays correct truthful copy when checkout is cancelled', () => {
    // Set hostname and origin in global window before URL overwrite
    Object.defineProperty(window, 'location', {
      value: new URL('https://id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app/configuracoes/assinatura?checkout=cancel'),
      writable: true,
      configurable: true
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionSettingsPage />
      </QueryClientProvider>
    );

    // Título correto
    expect(screen.getByText('Checkout interrompido')).toBeTruthy();

    // Texto não contém “sessão encerrada”
    const alertBody = screen.getByText(/Você saiu do checkout antes de concluir/i);
    expect(alertBody.textContent).not.toContain('sessão de checkout foi encerrada');
    expect(alertBody.textContent).not.toContain('encerrada.');

    // Texto contém “Nenhum pagamento foi realizado”
    expect(alertBody.textContent).toContain('Nenhum pagamento foi realizado');

    // Texto contém “avaliação gratuita continua normalmente”
    expect(alertBody.textContent).toContain('avaliação gratuita continua normalmente');

    // CTA permanece “Retomar checkout seguro — R$ 35,90/mês”
    const cta = screen.getByText('Retomar checkout seguro — R$ 35,90/mês');
    expect(cta).toBeTruthy();
    expect(cta.tagName).toBe('BUTTON');
  });
});