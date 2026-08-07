import { ReactNode, useEffect, useState } from 'react';

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Carregar o script do reCAPTCHA v2 manualmente se houver siteKey
    if (!siteKey) return;

    const scriptId = 'recaptcha-v2-script';
    if (document.getElementById(scriptId)) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit&hl=pt-BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError(true);
    document.head.appendChild(script);

    return () => {
      // O script geralmente deve permanecer, mas poderíamos limpar se necessário
    };
  }, []);

  // Provedor apenas injeta o contexto ou garante o script
  return <>{children}</>;
}
