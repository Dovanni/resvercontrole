import { describe, it, expect, vi } from 'vitest';
import { WhatsAppSupport } from '../src/components/WhatsAppSupport';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Tooltip components to avoid environment issues
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => React.createElement('div', null, children),
  TooltipTrigger: ({ children }: any) => React.createElement('div', null, children),
  TooltipContent: ({ children }: any) => React.createElement('div', null, children),
  TooltipProvider: ({ children }: any) => React.createElement('div', null, children),
}));

// Mock window.open
const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

describe('WhatsAppSupport Component', () => {
  it('generates the correct URL for the global button', () => {
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

  it('generates the correct URL for the subscription context link', () => {
    render(React.createElement(WhatsAppSupport, { variant: "link", message: "Olá! Preciso de ajuda com a assinatura do VEJAMAIS." }));
    const button = screen.getByLabelText(/Falar com o suporte VEJAMAIS pelo WhatsApp/i);
    fireEvent.click(button);
    
    const url = new URL(windowOpenSpy.mock.calls[1][0] as string);
    expect(url.searchParams.get('text')).toBe('Olá! Preciso de ajuda com a assinatura do VEJAMAIS.');
  });
});
