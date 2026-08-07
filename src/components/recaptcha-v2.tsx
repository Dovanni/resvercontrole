import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

interface RecaptchaV2Props {
  onVerify: (token: string | null) => void;
  className?: string;
}

export interface RecaptchaV2Ref {
  reset: () => void;
  getValue: () => string | null;
}

export const RecaptchaV2 = forwardRef<RecaptchaV2Ref, RecaptchaV2Props>(({ onVerify, className }, ref) => {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [loadError, setLoadError] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      recaptchaRef.current?.reset();
    },
    getValue: () => {
      return recaptchaRef.current?.getValue() || null;
    }
  }));

  if (!siteKey || siteKey === 'COLE_AQUI_A_CHAVE_DO_SITE') {
    return (
      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          A proteção contra robôs está aguardando configuração. Nenhum dado foi enviado.
        </AlertDescription>
      </Alert>
    );
  }

  useEffect(() => {
    // If we have a site key, ensure window.grecaptcha is being monitored
    // The component handles its own error, but let's be extra defensive
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && !(window as any).grecaptcha && !loadError) {
        // If after 10 seconds still no grecaptcha and no error yet, it might be stuck
        console.warn("reCAPTCHA script load timeout detected");
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loadError]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 mb-4 p-4 border rounded-md bg-muted/50">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-center font-medium">Erro ao carregar o reCAPTCHA.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-xs text-primary hover:underline"
        >
          Tentar carregar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={`flex justify-center mb-4 ${className || ''}`}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        hl="pt-BR"
        onChange={onVerify}
        onErrored={() => setLoadError(true)}
        onExpired={() => onVerify(null)}
      />
    </div>
  );
});

RecaptchaV2.displayName = "RecaptchaV2";
