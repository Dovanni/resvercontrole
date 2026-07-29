/**
 * Contrato multiempresa do DRE.
 *
 * O schema atual do Vejamais ainda é single-tenant: a autoridade estrutural é
 * `user_id` (RLS `user_id = auth.uid()` em todas as tabelas de negócio). Não
 * existem tabelas `empresas` nem `empresa_membros`.
 *
 * Este módulo cria o CONTRATO multiempresa sem migration destrutiva e sem
 * associação presumida:
 *
 *  - o tenant é SEMPRE resolvido no servidor, a partir do token autenticado;
 *  - o `empresaId` eventualmente enviado pelo frontend nunca autoriza nada:
 *    ele é apenas confrontado com o tenant resolvido no servidor;
 *  - todas as consultas do DRE são executadas com o cliente Supabase do
 *    usuário (RLS ativa). Nunca com service_role;
 *  - não há totalização automática de múltiplas empresas: uma execução do
 *    DRE cobre exatamente um tenant.
 *
 * Quando `empresas`/`empresa_membros` existirem, apenas `resolveTenant` muda:
 * ele passará a validar membership ativa e devolver o `empresa_id`.
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
 * `requestedEmpresaId` é tratado como preferência, jamais como autorização.
 */
export function resolveTenant(
  userId: string | undefined,
  requestedEmpresaId?: string | null,
  timezone?: string | null,
): TenantContext {
  if (!userId) {
    throw new TenantAuthorizationError("Usuário sem sessão válida.");
  }
  // Modelo atual: uma empresa por usuário, identificada pelo próprio user_id.
  const tenantId = userId;

  if (requestedEmpresaId && requestedEmpresaId !== tenantId) {
    // Bloqueio cross-tenant: nunca aceitar o identificador vindo do cliente.
    throw new TenantAuthorizationError(
      "Empresa solicitada não pertence ao usuário autenticado.",
    );
  }

  return {
    tenantId,
    userId,
    timezone: timezone || "America/Sao_Paulo",
    model: "user_id",
  };
}
