import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";

// Tipos e Interfaces
export interface MathChallenge {
  id: string;
  question: string;
  expiresAt: number;
}

// Em memória para o preview (em produção usaríamos Redis ou similar se necessário, 
// mas para o preview e isolamento de sessão o Worker state/context pode ser volátil)
// NOTA: Em Workers sem persistência, isso é por isolado. Para uma implementação real multi-sessão,
// usaríamos KV ou similar. Aqui, vamos usar uma estratégia de token assinado para evitar estado no servidor.

const SECRET_MATH = process.env['RECAPTCHA_SECRET_KEY'] || 'preview-secret-key-math';

function generateSignedChallenge(a: number, b: number) {
  const result = a + b;
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos
  
  // Criamos um payload que contém a resposta, mas assinado
  const payload = JSON.stringify({ r: result, exp: expiresAt, id });
  const signature = crypto.createHmac('sha256', SECRET_MATH).update(payload).digest('hex');
  
  return {
    challenge: {
      id: `${Buffer.from(payload).toString('base64')}.${signature}`,
      question: `Quanto é ${a} + ${b}?`,
      expiresAt
    }
  };
}

export const getMathChallenge = createServerFn({ method: "GET" })
  .handler(async () => {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    return generateSignedChallenge(a, b);
  });

export async function verifyMathChallenge(token: string, answer: string) {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return false;
    
    const payloadRaw = Buffer.from(payloadBase64, 'base64').toString();
    const expectedSignature = crypto.createHmac('sha256', SECRET_MATH).update(payloadRaw).digest('hex');
    
    if (signature !== expectedSignature) return false;
    
    const payload = JSON.parse(payloadRaw);
    if (Date.now() > payload.exp) return false;
    
    return parseInt(answer, 10) === payload.r;
  } catch {
    return false;
  }
}

export async function verifyRecaptcha(token: string) {
  const secretKey = process.env['RECAPTCHA_SECRET_KEY'];
  
  if (!secretKey) {
    console.warn("RECAPTCHA_CONFIGURATION_REQUIRED: Secret key missing");
    throw new Error("RECAPTCHA_CONFIGURATION_REQUIRED");
  }

  // Proteção contra reuso de token (Single Use)
  if (await isTokenUsed(token)) {
    return { success: false, error: 'Token already used' };
  }

  const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`, {
    method: 'POST'
  });

  const data = await response.json() as any;

  if (!data.success) {
    return { success: false, error: 'reCAPTCHA verification failed' };
  }

  // Marcar token como usado imediatamente após validação de sucesso
  await markTokenAsUsed(token);

  // Validação de hostname (domínios autorizados)
  const allowedHostnames = [
    'resvercontrole.lovable.app',
    'vejamais.com.br',
    'www.vejamais.com.br'
  ];
  
  const isAllowedHost = allowedHostnames.includes(data.hostname) || data.hostname.endsWith('.lovable.app');
  
  if (!isAllowedHost) {
    return { success: false, error: 'Invalid hostname' };
  }

  return { success: true };
}

// Rate limiting simples em memória (per-isolate no Worker)
// Para o preview é suficiente para evitar ataques básicos de bot.
const rateLimits = new Map<string, { count: number, resetAt: number }>();
const usedTokens = new Map<string, number>(); // token -> expiry

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  
  // Limpeza periódica de tokens expirados (pode ser feita aqui de forma simples)
  if (usedTokens.size > 1000) {
    for (const [token, expiry] of usedTokens.entries()) {
      if (now > expiry) usedTokens.delete(token);
    }
  }

  const record = rateLimits.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function isTokenUsed(token: string) {
  const now = Date.now();
  const expiry = usedTokens.get(token);
  if (expiry && now < expiry) return true;
  return false;
}

export async function markTokenAsUsed(token: string, expiryMs: number = 2 * 60 * 1000) {
  usedTokens.set(token, Date.now() + expiryMs);
}
