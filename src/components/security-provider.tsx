import { ReactNode } from 'react';

/**
 * Provedor de Segurança simplificado.
 * Removida toda a lógica de injeção manual e monitoramento do reCAPTCHA
 * para evitar dependência circular com o componente de segurança.
 */
export function SecurityProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
