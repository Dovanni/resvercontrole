import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Tipos e Interfaces
export interface MathChallenge {
  id: string;
  question: string;
  expiresAt: number;
}

const SECRET_MATH = process.env['RECAPTCHA_SECRET_KEY'] || 'preview-secret-key-math';
const RATE_LIMIT_HMAC_SECRET = process.env['RATE_LIMIT_HMAC_SECRET'];

function generateSignedChallenge(a: number, b: number) {
  const result = a + b;
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos
  
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

const getTurnstileSecret = () => process.env['TURNSTILE_SECRET_KEY'];
const HOSTNAME_ALLOWLIST = [
  'resvercontrole.lovable.app',
  'id-preview--c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovable.app',
  'c1cf42e3-5ea4-4a1b-a6cc-454256b65835.lovableproject.com',
  'vejamais.com.br',
  'www.vejamais.com.br'
];

export async function verifyTurnstile(token: string) {
  if (!token) return { success: false, error: 'Token ausente' };
  const secret = getTurnstileSecret();
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY não configurada no servidor');
    return { success: false, error: 'Erro de configuração' };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secret);
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

/**
 * Gera HMAC-SHA256 para uma identidade (IP ou e-mail) de forma segura.
 */
function hashIdentity(value: string) {
  if (!RATE_LIMIT_HMAC_SECRET) {
    throw new Error("RATE_LIMIT_HMAC_SECRET não configurado.");
  }
  return crypto.createHmac('sha256', RATE_LIMIT_HMAC_SECRET)
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * Consulta o estado atual de rate limiting no Supabase (Persistente).
 */
export async function checkRateLimitPersistent(scope: string, email?: string) {
  const request = (globalThis as any).request as Request;
  const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
  
  const ipHash = hashIdentity(clientIp);
  const emailHash = email ? hashIdentity(email) : null;

  // Verifica IP
  const { data: ipStatus, error: ipError } = await supabaseAdmin.rpc('get_auth_rate_limit_status', {
    p_scope: scope,
    p_identity_kind: 'ip',
    p_identity_hash: ipHash
  });

  if (ipError) throw ipError;
  if (ipStatus && ipStatus[0]?.is_blocked) {
    return { allowed: false, retryAfterSeconds: ipStatus[0].retry_after_seconds };
  }

  // Verifica E-mail se fornecido
  if (emailHash) {
    const { data: emailStatus, error: emailError } = await supabaseAdmin.rpc('get_auth_rate_limit_status', {
      p_scope: scope,
      p_identity_kind: 'email',
      p_identity_hash: emailHash
    });

    if (emailError) throw emailError;
    if (emailStatus && emailStatus[0]?.is_blocked) {
      return { allowed: false, retryAfterSeconds: emailStatus[0].retry_after_seconds };
    }
  }

  return { allowed: true };
}

/**
 * Registra uma falha de autenticação no Supabase (Persistente).
 */
export async function recordRateLimitFailure(scope: string, email: string, policy: { limit: number, cooldowns: number[], windowMs: number }) {
  const request = (globalThis as any).request as Request;
  const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
  
  const ipHash = hashIdentity(clientIp);
  const emailHash = hashIdentity(email);

  // Registra falha para IP e E-mail em paralelo
  const [ipRes, emailRes] = await Promise.all([
    supabaseAdmin.rpc('record_auth_failure', {
      p_scope: scope,
      p_identity_kind: 'ip',
      p_identity_hash: ipHash,
      p_limit: policy.limit,
      p_cooldown_minutes: policy.cooldowns,
      p_window_ms: policy.windowMs
    }),
    supabaseAdmin.rpc('record_auth_failure', {
      p_scope: scope,
      p_identity_kind: 'email',
      p_identity_hash: emailHash,
      p_limit: policy.limit,
      p_cooldown_minutes: policy.cooldowns,
      p_window_ms: policy.windowMs
    })
  ]);

  if (ipRes.error) throw ipRes.error;
  if (emailRes.error) throw emailRes.error;

  const maxRetry = Math.max(ipRes.data[0]?.retry_after_seconds || 0, emailRes.data[0]?.retry_after_seconds || 0);
  
  return { 
    retryAfterSeconds: maxRetry,
    isBlocked: maxRetry > 0
  };
}

/**
 * Reseta o estado de rate limit após sucesso (Persistente).
 */
export async function clearRateLimitPersistent(scope: string, email: string) {
  const request = (globalThis as any).request as Request;
  const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
  
  const ipHash = hashIdentity(clientIp);
  const emailHash = hashIdentity(email);

  await Promise.all([
    supabaseAdmin.rpc('reset_auth_rate_limit', {
      p_scope: scope,
      p_identity_kind: 'ip',
      p_identity_hash: ipHash
    }),
    supabaseAdmin.rpc('reset_auth_rate_limit', {
      p_scope: scope,
      p_identity_kind: 'email',
      p_identity_hash: emailHash
    })
  ]);
}
