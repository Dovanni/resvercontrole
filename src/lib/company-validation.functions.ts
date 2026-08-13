import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeCnpj, validateCnpj } from "@/lib/cnpj-validator";
import { checkRateLimit } from "@/lib/security.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const validateCnpjSchema = z.object({
  cnpj: z.string().min(1),
});

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
}

export const validateCompanyCnpj = createServerFn({ method: "POST" })
  .inputValidator((data) => validateCnpjSchema.parse(data))
  .handler(async ({ data }) => {
    const rawCnpj = data.cnpj;
    const normalized = normalizeCnpj(rawCnpj);

    // 1. Validar formato e DV
    if (!validateCnpj(normalized)) {
      throw new Error("Formato de CNPJ inválido ou dígitos verificadores incorretos.");
    }

    // 2. Rate Limit Persistente via Supabase RPC
    const { data: allowed, error: rateError } = await supabaseAdmin.rpc('check_rate_limit_persistent', {
      _key: `rate:cnpj:fn:${normalized}`,
      _limit: 5,
      _window_interval: '24 hours'
    });

    if (rateError || !allowed) {
      throw new Error("Muitas consultas para este CNPJ hoje. Aguarde.");
    }

    // 3. Verificar duplicidade no banco
    const { data: existing } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .eq('documento', normalized)
      .maybeSingle();

    if (existing) {
      throw new Error("EXISTING_COMPANY");
    }

    // 4. Consultar Provedor (Reclassificado como THIRD_PARTY_PUBLIC_DATA_PROVIDER)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("CNPJ não localizado na base pública (THIRD_PARTY_PUBLIC_DATA_PROVIDER).");
        }
        throw new Error("Serviço de consulta externa indisponível no momento.");
      }

      const raw = await response.json() as any;

      // 5. Normalizar Resposta (Sanitização estrita)
      const result: CompanyValidationResult = {
        cnpj: normalized,
        razao_social: raw.razao_social || raw.nome_empresarial || "NÃO INFORMADO",
        nome_fantasia: raw.nome_fantasia || "",
        situacao_cadastral: raw.descricao_situacao_cadastral || "ATIVA",
        data_abertura: raw.data_inicio_atividade || "",
        natureza_juridica: raw.natureza_juridica || "",
        porte: raw.porte || "",
        cnae_principal: raw.cnae_fiscal_descricao || "",
        municipio: raw.municipio || "",
        uf: raw.uf || "",
        endereco_complet_omitted: true,
        source: "THIRD_PARTY_PUBLIC_DATA_PROVIDER",
        validated_at: new Date().toISOString(),
        version: "2026.1"
      };

      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error("A consulta ao provedor externo demorou muito. Tente novamente.");
      }
      throw err;
    }
  });
