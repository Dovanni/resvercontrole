import { ReactNode, useEffect, useState, useMemo } from 'react';

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const scriptUrl = useMemo(() => 
    `https://www.google.com/recaptcha/api.js?render=explicit&hl=pt-BR&_retry=${retryCount}`,
    [retryCount]
  );

  useEffect(() => {
    // Carregar o script do reCAPTCHA v2 manualmente se houver siteKey
    if (!siteKey) return;

    const scriptId = 'recaptcha-v2-script';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (existingScript) {
      if (scriptLoaded) return;
      // If it exists but didn't load (maybe failed before), we might need to remove and re-add or just wait
      // But adding multiple scripts is bad. Let's just track it.
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("reCAPTCHA v2 script loaded successfully");
      setScriptLoaded(true);
      setError(false);
    };
    script.onerror = () => {
      console.error("reCAPTCHA v2 script failed to load");
      setError(true);
    };
    document.head.appendChild(script);

    return () => {
      // We keep the script to avoid flickering on re-mounts
    };
  }, [retryCount, scriptUrl, scriptLoaded]);

  const handleRetry = () => {
    const scriptId = 'recaptcha-v2-script';
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();
    setScriptLoaded(false);
    setError(false);
    setRetryCount(prev => prev + 1);
  };

  // Provedor apenas injeta o contexto ou garante o script
  return (
    <>
      {error && (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-destructive text-destructive-foreground rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-sm font-medium">Erro de conexão com o serviço de segurança.</div>
          <button 
            onClick={handleRetry}
            className="px-3 py-1 bg-background/20 hover:bg-background/30 rounded text-xs font-bold transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {children}
    </>
  );
}
