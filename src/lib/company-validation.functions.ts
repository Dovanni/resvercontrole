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

    // 2. Rate Limit (por IP e hash do CNPJ)
    const request = (globalThis as any).request as Request;
    const clientIp = request?.headers.get('x-forwarded-for') || 'unknown';
    
    // Hash simples para rate limit por CNPJ
    const cnpjKey = `rate:cnpj:${normalized}`;
    const ipKey = `rate:ip:${clientIp}`;

    const [allowedCnpj, allowedIp] = await Promise.all([
      checkRateLimit(cnpjKey, 5, 24 * 60 * 60 * 1000), // 5 por dia por CNPJ
      checkRateLimit(ipKey, 20, 60 * 60 * 1000)      // 20 por hora por IP
    ]);

    if (!allowedCnpj || !allowedIp) {
      throw new Error("Muitas consultas. Aguarde.");
    }

    // 3. Verificar se já existe no banco
    const { data: existing } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .eq('documento', normalized)
      .maybeSingle();

    if (existing) {
      // Regra: Não revelar dados, orientar convite
      throw new Error("EXISTING_COMPANY");
    }

    // 4. Consultar Provedor (Mock para homologação visual inicial ou Integração Real)
    // No METRIXHR usa-se geralmente a BrasilAPI ou ReceitaWS.
    // Implementaremos um adapter resiliente.
    
    try {
      // Timeout de 8s para API externa
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Usando BrasilAPI como provedor primário (homologado)
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${normalized}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("CNPJ não localizado na base da Receita Federal.");
        }
        throw new Error("Serviço de consulta temporariamente indisponível.");
      }

      const raw = await response.json();

      // 5. Normalizar Resposta (Allowlist estrita)
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
        source: "BrasilAPI",
        validated_at: new Date().toISOString(),
        version: "2026.1"
      };

      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error("O serviço de consulta demorou muito para responder. Tente novamente.");
      }
      throw err;
    }
  });
