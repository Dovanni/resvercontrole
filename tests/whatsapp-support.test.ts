/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppSupport } from '../src/components/WhatsAppSupport';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

// Mock shadcn button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => 
    React.createElement('button', { ...props }, children),
}));

describe('WhatsAppSupport Component', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Global Button', () => {
    it('generates the correct URL for the global button', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => ({} as Window));
      render(React.createElement(WhatsAppSupport));
      
      const button = screen.getByLabelText(/Falar com o suporte VEJAMAIS pelo WhatsApp/i);
      fireEvent.click(button);
      
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/5517992822622'),
        '_blank',
        'noopener,noreferrer'
      );
      
      const url = new URL(windowOpenSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get('text')).toBe('Olá! Preciso de ajuda com o VEJAMAIS.');
    });
  });

  describe('Link Variant', () => {
    it('generates the correct URL for the subscription context link', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => ({} as Window));
      render(React.createElement(WhatsAppSupport, { variant: "link", message: "Olá! Preciso de ajuda com a assinatura do VEJAMAIS." }));
      
      const button = screen.getByLabelText(/Falar com o suporte VEJAMAIS pelo WhatsApp/i);
      fireEvent.click(button);
      
      expect(windowOpenSpy).toHaveBeenCalled();
      const url = new URL(windowOpenSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get('text')).toBe('Olá! Preciso de ajuda com a assinatura do VEJAMAIS.');
    });
  });
});
