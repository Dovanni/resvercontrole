import { createFileRoute } from "@tanstack/react-router";
import { normalizeCnpj, validateCnpj } from "@/lib/cnpj-validator";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";

export interface SanitizedCompany {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_abertura: string;
  natureza_juridica: string;
  municipio: string;
  uf: string;
  trace_id: string;
}

export const Route = createFileRoute("/api/public/company/validate-cnpj")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        try {
          const body = await request.json();
          const { cnpj } = body;

          if (!cnpj) {
            return new Response(JSON.stringify({ error: "CNPJ_REQUIRED", trace_id: traceId }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const normalized = normalizeCnpj(cnpj);

          // 1. Validar localmente (Formato e DV)
          if (!validateCnpj(normalized)) {
            return new Response(JSON.stringify({ 
              error: "INVALID_CNPJ_FORMAT", 
              reason_code: "LOCAL_DV_INVALID",
              trace_id: traceId 
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 2. Rate Limit (Atômico e Persistente via DB)
          const { data: allowed, error: rateError } = await supabaseAdmin.rpc('check_rate_limit_persistent', {
            _key: `rate:cnpj:api:${normalized}`,
            _limit: 10,
            _window_interval: '24 hours'
          });

          if (rateError || !allowed) {
            return new Response(JSON.stringify({ 
              error: "RATE_LIMITED", 
              reason_code: "RATE_LIMIT_EXCEEDED",
              trace_id: traceId
            }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 3. Verificar duplicidade no banco
          const { data: existing } = await supabaseAdmin
            .from("empresas")
            .select("id")
            .eq("documento", normalized)
            .maybeSingle();

          if (existing) {
            return new Response(JSON.stringify({ 
              error: "EXISTING_COMPANY", 
              reason_code: "DUPLICATE_COMPANY",
              trace_id: traceId 
            }), {
              status: 409,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 4. Consultar provedor externo (BrasilAPI)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          try {
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
              let reasonCode = "PROVIDER_ERROR";
              let status = 503;
              let errorLabel = "PROVIDER_UNAVAILABLE";

              if (response.status === 404) {
                if (isAlphanumeric) {
                  errorLabel = "PROVIDER_ALPHANUMERIC_NOT_SUPPORTED";
                  reasonCode = "ALPHANUMERIC_NOT_SUPPORTED";
                  status = 404;
                } else {
                  errorLabel = "NOT_FOUND";
                  reasonCode = "PROVIDER_RECORD_NOT_FOUND";
                  status = 404;
                }
              } else if (response.status === 429) {
                reasonCode = "PROVIDER_HTTP_429";
              } else if (response.status >= 400 && response.status < 500) {
                reasonCode = `PROVIDER_HTTP_${response.status}`;
              } else if (response.status >= 500) {
                reasonCode = "PROVIDER_HTTP_5XX";
              }

              return new Response(JSON.stringify({ 
                error: errorLabel, 
                reason_code: reasonCode,
                provider_status: response.status,
                trace_id: traceId 
              }), {
                status,
                headers: { "Content-Type": "application/json" },
              });
            }

            const raw = await response.json();
            
            // 5. Sanitização estrita (Remover PII, QSA) e Allowlisting
            const sanitized: SanitizedCompany = {
              cnpj: normalized,
              razao_social: raw.razao_social || raw.nome_empresarial || "NÃO INFORMADO",
              nome_fantasia: raw.nome_fantasia || "",
              situacao_cadastral: raw.descricao_situacao_cadastral || raw.situacao_cadastral || "ATIVA",
              data_abertura: raw.data_inicio_atividade || "",
              natureza_juridica: raw.natureza_juridica || "",
              municipio: raw.municipio || "",
              uf: raw.uf || "",
              trace_id: traceId
            };

            return new Response(JSON.stringify({
              valid: true,
              status: "SUCCESS",
              company: sanitized,
              provider: "THIRD_PARTY_PUBLIC_DATA_PROVIDER",
              trace_id: traceId
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });

          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            let reasonCode = "SERVER_RUNTIME_FETCH_FAILURE";
            if (fetchError.name === "AbortError") {
              reasonCode = "PROVIDER_TIMEOUT";
            }
            console.error(`[API Validate CNPJ] Fetch Error [${traceId}]:`, fetchError);
            return new Response(JSON.stringify({ 
              error: "PROVIDER_UNAVAILABLE", 
              reason_code: reasonCode,
              trace_id: traceId 
            }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          }

        } catch (error: any) {
          console.error(`[API Validate CNPJ] Unexpected Error [${traceId}]:`, error);
          return new Response(JSON.stringify({ 
            error: "INTERNAL_ERROR", 
            reason_code: "UNEXPECTED_SERVER_ERROR",
            trace_id: traceId 
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
