import { useRef, forwardRef, useImperativeHandle, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const siteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();

interface RecaptchaV2Props {
  onVerify: (token: string | null) => void;
  className?: string;
}

export interface RecaptchaV2Ref {
  reset: () => void;
  getValue: () => string | null;
}

/**
 * Componente Único reCAPTCHA v2.
 * Responsável exclusivo por carregar o script oficial via react-google-recaptcha.
 */
export const RecaptchaV2 = forwardRef<RecaptchaV2Ref, RecaptchaV2Props>(({ onVerify, className }, ref) => {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [loadError, setLoadError] = useState(false);
  const [key, setKey] = useState(0); // Usada para forçar o remonte e retry seguro

  useImperativeHandle(ref, () => ({
    reset: () => {
      recaptchaRef.current?.reset();
    },
    getValue: () => {
      return recaptchaRef.current?.getValue() || null;
    }
  }));

  // Validação de configuração
  if (!siteKey || siteKey === 'COLE_AQUI_A_CHAVE_DO_SITE' || siteKey === 'your-site-key-here') {
    return (
      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          A proteção contra robôs está aguardando configuração técnica. Por favor, contate o suporte.
        </AlertDescription>
      </Alert>
    );
  }

  // Estado de erro de carga
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 mb-4 p-4 border rounded-md bg-muted/50 border-destructive/30">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div className="text-center">
          <p className="text-sm font-medium">Erro ao carregar o serviço de segurança.</p>
          <p className="text-xs text-muted-foreground mt-1">Isso pode ser causado por bloqueadores de anúncios ou instabilidade de rede.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setLoadError(false);
            setKey(prev => prev + 1);
          }} 
          className="text-xs gap-2"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar carregar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex justify-center mb-4 ${className || ''}`} key={key}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        hl="pt-BR"
        onChange={onVerify}
        onErrored={() => {
          console.error("reCAPTCHA component reported an error during load/execution");
          setLoadError(true);
        }}
        onExpired={() => onVerify(null)}
      />
    </div>
  );
});

RecaptchaV2.displayName = "RecaptchaV2";
