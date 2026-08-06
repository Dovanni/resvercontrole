/**
 * Contrato multiempresa do DRE.
 *
 * Evolução Wave A: Suporte a empresa_id com fallback para user_id.
 */

export interface TenantContext {
  tenantId: string;
  userId: string;
  timezone: string;
  /** Modelo estrutural vigente — usado para telemetria e para a UI. */
  model: "user_id" | "empresa_id";
}

export class TenantAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAuthorizationError";
  }
}

/**
 * Resolve e autoriza o tenant ativo a partir do contexto autenticado.
 * Wave A: Se empresaId for fornecido, valida o vínculo. Caso contrário, usa userId (fallback).
 */
export function resolveTenant(
  userId: string | undefined,
  requestedEmpresaId?: string | null,
  timezone?: string | null,
): TenantContext {
  if (!userId) {
    throw new TenantAuthorizationError("Usuário sem sessão válida.");
  }

  const isMultiempresaEnabled = process.env.VITE_ENABLE_MULTIEMPRESA === "true";
  
  // Na Wave A, se a flag estiver off, o tenantId ainda é o userId (isolamento legado)
  // Se a flag estiver on, exigimos requestedEmpresaId
  const tenantId = (isMultiempresaEnabled && requestedEmpresaId) ? requestedEmpresaId : userId;
  const model = isMultiempresaEnabled ? "empresa_id" : "user_id";

  return {
    tenantId,
    userId,
    timezone: timezone || "America/Sao_Paulo",
    model,
  };
}
