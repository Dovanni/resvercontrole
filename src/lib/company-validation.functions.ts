import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeCnpj, validateCnpj as validateCnpjCheck } from "@/lib/cnpj-validator";
import crypto from "crypto";

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

    console.info('[VCRL-G2.11] validateCnpj start', {
      trace_id: traceId,
    });

    // 1. Validar formato e DV
    if (!validateCnpjCheck(normalized)) {
      throw new Error(JSON.stringify({ 
        error: "INVALID_CNPJ_FORMAT", 
        reason_code: "LOCAL_DV_INVALID",
        trace_id: traceId 
      }));
    }

    // Carregar cliente administrativo apenas no runtime server-side.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Rate Limit Persistente via Supabase RPC
    const { data: allowed, error: rateError } = await supabaseAdmin.rpc('check_rate_limit_persistent', {
      _key: `rate:cnpj:fn:${normalized}`,
      _limit: 10,
      _window_interval: '24 hours'
    });

    console.info('[VCRL-G2.11] RPC result shape', {
      trace_id: traceId,
      allowed_type: typeof allowed,
      allowed_is_null: allowed === null,
      rate_error_type: typeof rateError,
      rate_error_constructor: rateError?.constructor?.name ?? null,
      rate_error_has_code: Boolean(rateError && 'code' in rateError),
      rate_error_has_message: Boolean(rateError && 'message' in rateError),
      rate_error_has_details: Boolean(rateError && 'details' in rateError),
      rate_error_has_hint: Boolean(rateError && 'hint' in rateError),
    });

    // Erro técnico da RPC não deve ser mascarado como limite excedido.
    if (rateError) {
      console.error('[VCRL-G2.9] CNPJ rate-limit RPC failure', {
        trace_id: traceId,
        rpc: 'check_rate_limit_persistent',
        rpc_error_code: sanitizeRpcDiagnostic(rateError.code),
        rpc_error_message: sanitizeRpcDiagnostic(rateError.message),
        rpc_error_details: sanitizeRpcDiagnostic(rateError.details),
        rpc_error_hint: sanitizeRpcDiagnostic(rateError.hint),
      });

      throw new Error(JSON.stringify({
        error: "CNPJ_VALIDATION_UNAVAILABLE",
        reason_code: "RATE_LIMIT_RPC_ERROR",
        trace_id: traceId
      }));
    }

    // Apenas allowed=false representa rate limit efetivamente excedido.
    if (!allowed) {
      throw new Error(JSON.stringify({ 
        error: "RATE_LIMITED", 
        reason_code: "RATE_LIMIT_EXCEEDED",
        trace_id: traceId 
      }));
    }

    // 3. Verificar duplicidade no banco
    const { data: existing } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .eq('documento', normalized)
      .maybeSingle();

    if (existing) {
      throw new Error(JSON.stringify({ 
        error: "EXISTING_COMPANY", 
        reason_code: "DUPLICATE_COMPANY",
        trace_id: traceId 
      }));
    }

    // 4. Consultar Provedor (Reclassificado como THIRD_PARTY_PUBLIC_DATA_PROVIDER)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
        method: "GET",
        headers: { 
          "Accept": "application/json",
          "User-Agent": "Vejamais-Validator/1.0"
        },
        signal: controller.signal
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
          trace_id: traceId 
        }));
      }

      const raw = await response.json() as any;

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
        trace_id: traceId
      };

      console.info('[VCRL-G2.11] validateCnpj success', {
        trace_id: traceId,
      });

      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(JSON.stringify({ 
          error: "A consulta ao provedor externo demorou muito. Tente novamente.", 
          reason_code: "PROVIDER_TIMEOUT",
          trace_id: traceId 
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
          original_error: err.message
        }));
      }
    }
  });
