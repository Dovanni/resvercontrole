import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { normalizeCnpj, validateCnpj as validateCnpjCheck } from "@/lib/cnpj-validator";
import crypto from "crypto";

const CANONICAL_SUPABASE_URL = "https://hoalgniwydgydqaugqph.supabase.co";

const validateCnpjSchema = z.object({
  cnpj: z.string().min(1),
});

function sanitizeRpcDiagnostic(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  return String(value)
    .replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED_JWT]")
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_KEY]")
    .slice(0, 500);
}

function readRuntimeSecret(name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

async function checkCnpjRateLimitDirect(normalized: string, traceId: string): Promise<boolean> {
  const serviceRoleKey = readRuntimeSecret("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[VCRL-G2.21] Direct rate-limit RPC transport failure", {
      trace_id: traceId,
      rpc: "check_rate_limit_persistent",
      http_status: null,
      response_ok: false,
      error_message: "Missing Cloudflare runtime secret: SUPABASE_SERVICE_ROLE_KEY",
    });

    throw new Error(JSON.stringify({
      error: "CNPJ_VALIDATION_UNAVAILABLE",
      reason_code: "RATE_LIMIT_RPC_TRANSPORT_ERROR",
      trace_id: traceId,
    }));
  }

  let response: Response;
  try {
    response = await fetch(`${CANONICAL_SUPABASE_URL}/rest/v1/rpc/check_rate_limit_persistent`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _key: `rate:cnpj:fn:${normalized}`,
        _limit: 10,
        _window_interval: "24 hours",
      }),
    });
  } catch (error) {
    console.error("[VCRL-G2.21] Direct rate-limit RPC transport failure", {
      trace_id: traceId,
      rpc: "check_rate_limit_persistent",
      http_status: null,
      response_ok: false,
      error_message: sanitizeRpcDiagnostic(error instanceof Error ? error.message : error),
    });

    throw new Error(JSON.stringify({
      error: "CNPJ_VALIDATION_UNAVAILABLE",
      reason_code: "RATE_LIMIT_RPC_TRANSPORT_ERROR",
      trace_id: traceId,
    }));
  }

  const responseText = await response.text();

  if (!response.ok) {
    console.error("[VCRL-G2.21] Direct rate-limit RPC HTTP failure", {
      trace_id: traceId,
      rpc: "check_rate_limit_persistent",
      http_status: response.status,
      response_ok: false,
      error_message: sanitizeRpcDiagnostic(responseText),
    });

    throw new Error(JSON.stringify({
      error: "CNPJ_VALIDATION_UNAVAILABLE",
      reason_code: "RATE_LIMIT_RPC_HTTP_ERROR",
      provider_status: response.status,
      trace_id: traceId,
    }));
  }

  let allowed: unknown;
  try {
    allowed = JSON.parse(responseText);
  } catch {
    console.error("[VCRL-G2.21] Direct rate-limit RPC invalid response", {
      trace_id: traceId,
      rpc: "check_rate_limit_persistent",
      http_status: response.status,
      response_ok: true,
      error_message: "RPC returned a non-JSON response",
    });

    throw new Error(JSON.stringify({
      error: "CNPJ_VALIDATION_UNAVAILABLE",
      reason_code: "RATE_LIMIT_RPC_INVALID_RESPONSE",
      trace_id: traceId,
    }));
  }

  if (typeof allowed !== "boolean") {
    console.error("[VCRL-G2.21] Direct rate-limit RPC invalid response", {
      trace_id: traceId,
      rpc: "check_rate_limit_persistent",
      http_status: response.status,
      response_ok: true,
      error_message: "RPC response was not boolean",
    });

    throw new Error(JSON.stringify({
      error: "CNPJ_VALIDATION_UNAVAILABLE",
      reason_code: "RATE_LIMIT_RPC_INVALID_RESPONSE",
      trace_id: traceId,
    }));
  }

  return allowed;
}

// Interface para o retorno simplificado (allowlisted)
export interface CompanyValidationResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_abertura: string;
  natureza_juridica: string;
  porte: string;
  cnae_principal: string;
  municipio: string;
  uf: string;
  endereco_complet_omitted: boolean;
  source: string;
  validated_at: string;
  version: string;
  trace_id: string;
}

export const validateCnpj = createServerFn({ method: "POST" })
  .inputValidator((data) => validateCnpjSchema.parse(data))
  .handler(async ({ data }) => {
    const traceId = crypto.randomUUID();
    const rawCnpj = data.cnpj;
    const normalized = normalizeCnpj(rawCnpj);

    // 1. Validar formato e DV
    if (!validateCnpjCheck(normalized)) {
      throw new Error(JSON.stringify({
        error: "INVALID_CNPJ_FORMAT",
        reason_code: "LOCAL_DV_INVALID",
        trace_id: traceId,
      }));
    }

    // 2. Rate Limit Persistente via PostgREST direto.
    // O secret administrativo e enviado exclusivamente no header apikey.
    const allowed = await checkCnpjRateLimitDirect(normalized, traceId);

    // Apenas allowed=false representa rate limit efetivamente excedido.
    if (!allowed) {
      throw new Error(JSON.stringify({
        error: "RATE_LIMITED",
        reason_code: "RATE_LIMIT_EXCEEDED",
        trace_id: traceId,
      }));
    }

    // Carregar o cliente administrativo somente depois do rate limit aprovado.
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();

    // 3. Verificar duplicidade no banco
    const { data: existing } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("documento", normalized)
      .maybeSingle();

    if (existing) {
      throw new Error(JSON.stringify({
        error: "EXISTING_COMPANY",
        reason_code: "DUPLICATE_COMPANY",
        trace_id: traceId,
      }));
    }

    // 4. Consultar Provedor (Reclassificado como THIRD_PARTY_PUBLIC_DATA_PROVIDER)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Vejamais-Validator/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isAlphanumeric = /[A-Z]/.test(normalized);
        let errorLabel = "Serviço de consulta externa indisponível no momento.";
        let reasonCode = "PROVIDER_ERROR";

        if (response.status === 404) {
          if (isAlphanumeric) {
            errorLabel = "PROVIDER_ALPHANUMERIC_NOT_SUPPORTED";
            reasonCode = "ALPHANUMERIC_NOT_SUPPORTED";
          } else {
            errorLabel = "CNPJ não localizado na base pública.";
            reasonCode = "PROVIDER_RECORD_NOT_FOUND";
          }
        } else if (response.status === 429) {
          reasonCode = "PROVIDER_HTTP_429";
        } else if (response.status >= 500) {
          reasonCode = "PROVIDER_HTTP_5XX";
        }

        throw new Error(JSON.stringify({
          error: errorLabel,
          reason_code: reasonCode,
          provider_status: response.status,
          trace_id: traceId,
        }));
      }

      const raw = (await response.json()) as any;

      // 5. Normalizar Resposta (Sanitização estrita)
      const result: CompanyValidationResult = {
        cnpj: normalized,
        razao_social: raw.razao_social || raw.nome_empresarial || "NÃO INFORMADO",
        nome_fantasia: raw.nome_fantasia || "",
        situacao_cadastral: raw.descricao_situacao_cadastral || raw.situacao_cadastral || "ATIVA",
        data_abertura: raw.data_inicio_atividade || "",
        natureza_juridica: raw.natureza_juridica || "",
        porte: raw.porte || "",
        cnae_principal: raw.cnae_fiscal_descricao || "",
        municipio: raw.municipio || "",
        uf: raw.uf || "",
        endereco_complet_omitted: true,
        source: "THIRD_PARTY_PUBLIC_DATA_PROVIDER",
        validated_at: new Date().toISOString(),
        version: "2026.1",
        trace_id: traceId,
      };

      return result;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(JSON.stringify({
          error: "A consulta ao provedor externo demorou muito. Tente novamente.",
          reason_code: "PROVIDER_TIMEOUT",
          trace_id: traceId,
        }));
      }

      // Se já for uma string JSON (nossos erros customizados), repassa
      try {
        JSON.parse(err.message);
        throw err;
      } catch {
        // Erro inesperado
        throw new Error(JSON.stringify({
          error: "Erro inesperado na consulta do CNPJ.",
          reason_code: "SERVER_RUNTIME_FETCH_FAILURE",
          trace_id: traceId,
          original_error: err.message,
        }));
      }
    }
  });
