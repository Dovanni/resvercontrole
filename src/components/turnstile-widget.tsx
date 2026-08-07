import { useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

interface TurnstileWidgetProps {
  onVerify: (token: string | null) => void;
  className?: string;
}

export interface TurnstileWidgetRef {
  reset: () => void;
}

/**
 * Componente central para o Cloudflare Turnstile.
 * Substitui o Google reCAPTCHA v2.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(({ onVerify, className }, ref) => {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);

  useImperativeHandle(ref, () => ({
    reset: () => {
      turnstileRef.current?.reset();
    }
  }));

  if (!siteKey) {
    return (
      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Configuração pendente: VITE_TURNSTILE_SITE_KEY necessária para proteção contra robôs.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 mb-4 p-4 border rounded-md bg-muted/50 border-destructive/30">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div className="text-center">
          <p className="text-sm font-medium">Erro no serviço de segurança.</p>
          <p className="text-xs text-muted-foreground mt-1">Falha ao carregar o verificador de integridade.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setError(false);
            setKey(prev => prev + 1);
          }} 
          className="text-xs gap-2"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex justify-center mb-4 ${className || ''}`} key={key}>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        options={{
          language: 'pt-BR',
          theme: 'light',
        }}
        onSuccess={onVerify}
        onError={() => setError(true)}
        onExpire={() => onVerify(null)}
      />
    </div>
  );
});

TurnstileWidget.displayName = "TurnstileWidget";
