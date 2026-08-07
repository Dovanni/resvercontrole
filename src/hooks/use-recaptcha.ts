import { useState, useCallback } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

export function useRecaptcha() {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [loading, setLoading] = useState(false);

  const getToken = useCallback(async (action: string) => {
    if (!executeRecaptcha) {
      console.warn("reCAPTCHA not yet available");
      return null;
    }
    setLoading(true);
    try {
      const token = await executeRecaptcha(action);
      return token;
    } catch (error) {
      console.error("reCAPTCHA execution error:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [executeRecaptcha]);

  return { getToken, loading };
}
