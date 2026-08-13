/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppSupport } from '../src/components/WhatsAppSupport';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

// Mock Tooltip components to avoid environment issues
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => React.createElement('div', { 'data-testid': 'tooltip' }, children),
  TooltipTrigger: ({ children }: any) => React.createElement('div', { 'data-testid': 'tooltip-trigger' }, children),
  TooltipContent: ({ children }: any) => React.createElement('div', { 'data-testid': 'tooltip-content' }, children),
  TooltipProvider: ({ children }: any) => React.createElement('div', { 'data-testid': 'tooltip-provider' }, children),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  MessageCircle: () => React.createElement('span', null, 'Icon'),
}));

describe('WhatsAppSupport Component', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Global Button', () => {
    it('renders as an anchor with the correct URL for the global button', () => {
      render(React.createElement(WhatsAppSupport));
      
      const anchor = screen.getByLabelText(/Falar com o suporte VEJAMAIS pelo WhatsApp/i) as HTMLAnchorElement;
      expect(anchor.tagName).toBe('A');
      expect(anchor.href).toContain('https://wa.me/5517992822622');
      expect(anchor.target).toBe('_blank');
      expect(anchor.rel).toBe('noopener noreferrer');
      
      const url = new URL(anchor.href);
      expect(url.searchParams.get('text')).toBe('Olá! Preciso de ajuda com o VEJAMAIS.');
    });
  });

  describe('Link Variant', () => {
    it('renders as an anchor with the correct URL for the subscription context link', () => {
      render(React.createElement(WhatsAppSupport, { variant: "link", message: "Olá! Preciso de ajuda com a assinatura do VEJAMAIS." }));
      
      const anchor = screen.getByLabelText(/Falar com o suporte VEJAMAIS pelo WhatsApp/i) as HTMLAnchorElement;
      expect(anchor.tagName).toBe('A');
      expect(anchor.href).toContain('https://wa.me/5517992822622');
      
      const url = new URL(anchor.href);
      expect(url.searchParams.get('text')).toBe('Olá! Preciso de ajuda com a assinatura do VEJAMAIS.');
    });
  });
});
