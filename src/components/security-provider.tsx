import { ReactNode } from 'react';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export function SecurityProvider({ children }: { children: ReactNode }) {
  if (!siteKey) {
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      language="pt-BR"
      useRecaptchaNet
      scriptProps={{
        async: true,
        defer: true,
        appendTo: 'head',
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
