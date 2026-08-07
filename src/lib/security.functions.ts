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

const TURNSTILE_SECRET = process.env['TURNSTILE_SECRET_KEY'];
const HOSTNAME_ALLOWLIST = [
  'resvercontrole.lovable.app',
  'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app',
  'c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovableproject.com',
  'vejamais.com.br',
  'www.vejamais.com.br'
];

export async function verifyTurnstile(token: string) {
  if (!token) return { success: false, error: 'Token ausente' };
  if (!TURNSTILE_SECRET) {
    console.error('TURNSTILE_SECRET_KEY não configurada no servidor');
    return { success: false, error: 'Erro de configuração' };
  }

  try {
    const formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET);
    formData.append('response', token);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await result.json();

    if (!outcome.success) {
      return { success: false, error: 'Desafio inválido' };
    }

    if (outcome.hostname && !HOSTNAME_ALLOWLIST.includes(outcome.hostname)) {
      console.error(`Hostname não autorizado: ${outcome.hostname}`);
      return { success: false, error: 'Origem não autorizada' };
    }

    return { success: true };
  } catch (err) {
    console.error('Erro ao validar Turnstile:', err);
    return { success: false, error: 'Erro na verificação' };
  }
}

export async function verifyRecaptcha(token: string) {
  return verifyTurnstile(token);
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
