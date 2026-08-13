import { createFileRoute } from "@tanstack/react-router";
import { normalizeCnpj, validateCnpj } from "@/lib/cnpj-validator";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/lib/security.functions";

export interface SanitizedCompany {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_abertura: string;
  natureza_juridica: string;
  municipio: string;
  uf: string;
}

export const Route = createFileRoute("/api/public/company/validate-cnpj")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { cnpj } = body;

          if (!cnpj) {
            return new Response(JSON.stringify({ error: "CNPJ_REQUIRED" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const normalized = normalizeCnpj(cnpj);

          // 1. Validar localmente
          if (!validateCnpj(normalized)) {
            return new Response(JSON.stringify({ error: "INVALID_CNPJ_FORMAT" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 2. Rate Limit
          // 2. Rate Limit (Atômico e Persistente via DB)
          const { data: allowed, error: rateError } = await supabaseAdmin.rpc('check_rate_limit_persistent', {
            _key: `rate:cnpj:api:${normalized}`,
            _limit: 5,
            _window_interval: '24 hours'
          });

          if (rateError || !allowed) {
            return new Response(JSON.stringify({ 
              error: "RATE_LIMITED", 
              message: "Muitas consultas para este CNPJ hoje. Aguarde."
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
            return new Response(JSON.stringify({ error: "EXISTING_COMPANY" }), {
              status: 409,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 4. Consultar provedor externo (BrasilAPI)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const isAlphanumeric = /[A-Z]/.test(normalized);
            const error = (response.status === 404 && isAlphanumeric) 
              ? "PROVIDER_ALPHANUMERIC_NOT_SUPPORTED" 
              : (response.status === 404 ? "NOT_FOUND" : "PROVIDER_UNAVAILABLE");

            return new Response(JSON.stringify({ error }), {
              status: response.status === 404 ? 404 : 503,
              headers: { "Content-Type": "application/json" },
            });
          }

          const raw = await response.json();
          
          // 5. Sanitização estrita (Remover PII, QSA)
          const sanitized: SanitizedCompany = {
            cnpj: normalized,
            razao_social: raw.razao_social || raw.nome_empresarial || "NÃO INFORMADO",
            nome_fantasia: raw.nome_fantasia || "",
            situacao_cadastral: raw.descricao_situacao_cadastral || "ATIVA",
            data_abertura: raw.data_inicio_atividade || "",
            natureza_juridica: raw.natureza_juridica || "",
            municipio: raw.municipio || "",
            uf: raw.uf || "",
          };

          return new Response(JSON.stringify({
            valid: true,
            status: "SUCCESS",
            company: sanitized,
            provider: "THIRD_PARTY_PUBLIC_DATA_PROVIDER"
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });

        } catch (error: any) {
          console.error("[API Validate CNPJ] Error:", error);
          return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
