import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: WaveBReport,
});

function WaveBReport() {
  return (
    <div className="p-8 max-w-4xl mx-auto font-mono text-sm whitespace-pre-wrap">
      VMEAP_WAVE_B_IMPLEMENTATION_AUTHORIZATION

PROJETO

VEJAMAIS MULTIEMPRESA — ATUALIZAR E PUBLICAR

ETAPA AUTORIZADA

VMEAP WAVE B — INTEGRAÇÃO FUNCIONAL MULTIEMPRESA

PRECONDIÇÃO HOMOLOGADA

final_decision =
VMEAP_WAVE_A_POST_PUBLICATION_VALIDATED

published_domain =
https://resvercontrole.lovable.app

published_revision =
b2318cc923755ac2f69822086c4d6ded1d3d8c9d

published_tree_hash =
1344c40150d5a104460b2145dc4862ce7f133da7

published_supabase_project_identity =
bsrjtmssbnvttzrvnaab

feature_flag_value =
VITE_ENABLE_MULTIEMPRESA=false

Wave A homologada:

* 16 tabelas com empresa_id;
* backfill completo;
* zero registros nulos ou órfãos;
* membership ativo;
* RLS validado;
* isolamento cruzado aprovado;
* compatibilidade single-company preservada.

OBJETIVO

Implementar a experiência funcional multiempresa da VEJAMAIS:

1. Contexto seguro da empresa ativa.
2. Seletor de empresa/unidade.
3. Aplicação de empresa_id nas consultas e operações.
4. Autorização por papel e membership.
5. Gestão essencial de empresas e vínculos.
6. Fluxo seguro de convites, sem enviar convites reais nesta etapa.
7. Preservação integral da experiência single-company.

A implementação deverá permanecer protegida por:

VITE_ENABLE_MULTIEMPRESA=false

Não ativar nem publicar a Wave B.

1. CONTEXTO DA EMPRESA ATIVA

Criar camada centralizada, tipada e reutilizável para:

* carregar empresas vinculadas ao usuário autenticado;
* determinar empresa ativa válida;
* disponibilizar active_empresa_id;
* disponibilizar membership e papel do usuário;
* trocar a empresa ativa;
* impedir seleção de empresa sem vínculo;
* restaurar a última empresa válida;
* aplicar fallback seguro para a empresa principal;
* limpar o contexto no logout;
* reagir à revogação de membership.

A empresa ativa não poderá ser confiada apenas a localStorage.

Toda empresa restaurada ou selecionada deverá ser validada no servidor/RPC contra membership ativo.

2. SELETOR DE EMPRESA/UNIDADE

Implementar seletor responsivo e acessível no cabeçalho autenticado.

Requisitos:

* exibir nome da empresa ativa;
* indicar matriz ou filial quando essa classificação existir;
* listar somente empresas/unidades permitidas;
* destacar a empresa atual;
* permitir troca com confirmação visual;
* apresentar loading e estado de erro;
* funcionar em desktop e mobile;
* respeitar a identidade visual VEJAMAIS;
* não exibir IDs técnicos;
* não permitir seleção cruzada por manipulação de URL ou storage.

Com apenas uma empresa vinculada, preservar uma experiência simples, sem adicionar complexidade desnecessária ao usuário.

3. TROCA SEGURA DE EMPRESA

Ao trocar a empresa ativa:

* validar membership no servidor;
* atualizar o contexto;
* invalidar caches e queries da empresa anterior;
* cancelar requisições obsoletas quando aplicável;
* recarregar os dados da nova empresa;
* impedir mistura temporária de informações;
* manter estado visual de transição;
* registrar evento de auditoria sem conteúdo financeiro sensível.

Nenhum dado da empresa anterior poderá permanecer visível depois da troca.

4. INTEGRAÇÃO DAS ROTAS E MÓDULOS

Integrar active_empresa_id em todas as rotas autenticadas e módulos que consultem ou alterem as 16 tabelas migradas:

* aportes financeiros;
* contas bancárias;
* movimentos bancários;
* cartões;
* faturas;
* lançamentos de cartões;
* categorias de Contas a Pagar;
* compras e itens;
* clientes;
* Contas a Pagar;
* produtos;
* Contas a Receber;
* vendas e itens;
* fornecedores.

Auditar e corrigir também os consumidores existentes em:

* src/lib/bank/*
* src/lib/dre/*
* src/services/*
* rotas autenticadas;
* hooks de queries e mutations;
* relatórios e dashboards.

Toda mutation deverá obter empresa_id do contexto validado, e não de entrada arbitrária controlada pelo navegador.

5. AUTORIZAÇÃO POR PAPEL

Integrar has_role de maneira centralizada.

Requisitos:

* reutilizar os papéis já definidos no schema;
* não criar papel privilegiado paralelo;
* validar papel no contexto da empresa ativa;
* esconder ações não autorizadas na interface;
* bloquear também no banco/RPC;
* não confiar somente no frontend;
* impedir elevação de privilégio;
* preservar o acesso legítimo dos usuários atuais.

6. MATRIZ E FILIAIS

Aplicar o contrato já homologado de matriz/filial:

* separar empresa jurídica, matriz e unidade quando o modelo existente assim definir;
* permitir visão consolidada somente a papel expressamente autorizado;
* impedir que filial visualize outra filial sem autorização;
* identificar claramente o escopo atual;
* não misturar consolidação gerencial com propriedade dos registros;
* manter empresa_id como vínculo obrigatório dos dados.

Não inventar nova hierarquia incompatível com os contratos F2/F3 existentes.

7. GESTÃO ESSENCIAL

Implementar interface protegida para usuários autorizados:

* visualizar empresas/unidades vinculadas;
* visualizar membros e papéis;
* alterar empresa ativa;
* cadastrar ou configurar unidade somente se previsto pelo contrato homologado;
* desativar vínculo sem excluir histórico;
* impedir remoção do último administrador autorizado;
* impedir exclusão destrutiva de empresa com dados.

8. CONVITES

Implementar a base segura do fluxo de convites:

* convite vinculado à empresa correta;
* papel permitido explicitamente;
* token forte, temporário e de uso único;
* armazenamento somente do hash do token quando aplicável;
* expiração;
* revogação;
* aceite autenticado;
* prevenção de reutilização;
* auditoria;
* RLS e RPCs seguras;
* nenhuma service_role no navegador.

NESTA ETAPA:

* não enviar e-mail;
* não enviar convite real;
* não convidar pessoa;
* não usar endereço real;
* não criar dados sintéticos;
* não disparar integração externa.

Se o fluxo de convite exigir provedor externo ainda não homologado, implementar apenas a camada interna e declarar a dependência sem bloquear as demais funcionalidades da Wave B.

9. FEATURE FLAG

Toda nova interface multiempresa deverá permanecer protegida por:

VITE_ENABLE_MULTIEMPRESA=false

Com a flag false:

* comportamento publicado permanece single-company;
* seletor multiempresa não fica público;
* novas rotas não ficam acessíveis ao usuário comum;
* compatibilidade atual permanece integral.

Preparar preview controlado da interface sem alterar o valor publicado da flag.

10. TESTES OBRIGATÓRIOS

Validar:

* usuário com uma empresa;
* usuário com múltiplos memberships existentes, se houver;
* empresa ativa válida;
* tentativa de selecionar empresa sem vínculo;
* membership revogado;
* troca de empresa invalida caches;
* zero dados residuais da empresa anterior;
* leitura autorizada;
* leitura cruzada bloqueada;
* mutation autorizada;
* mutation cruzada bloqueada;
* papel insuficiente bloqueado;
* visão matriz autorizada;
* visão filial isolada;
* logout limpa contexto;
* reload restaura somente empresa válida;
* rotas diretas não contornam autorização;
* mobile e desktop;
* typecheck;
* build;
* testes existentes.

Não criar dados sintéticos para completar cenários ausentes. Declarar os testes não executáveis por falta de fixture previamente autorizada.

11. PRESERVAÇÕES

* Contas a Pagar permanece como fonte única de verdade financeira.
* Cartões permanecem painel de acompanhamento.
* Cartões não criam automaticamente pagamento, conta a pagar ou movimento bancário.
* Nenhum valor financeiro será recalculado.
* Nenhum registro será excluído.
* Nenhum ownership será alterado.
* user_id legado será preservado durante a transição.
* Landing page, identidade e SEO serão preservados.
* Zero Breaking Changes para usuários atuais.

12. PROIBIÇÕES

NÃO ativar VITE_ENABLE_MULTIEMPRESA.
NÃO publicar.
NÃO executar push.
NÃO remover user_id.
NÃO excluir tabelas ou colunas.
NÃO apagar ou recriar registros existentes.
NÃO criar dados sintéticos.
NÃO enviar convites ou mensagens.
NÃO expor service_role.
NÃO alterar valores financeiros.
NÃO iniciar a Wave C.
NÃO reabrir a Wave 1 ou a Wave A homologadas.

13. SAÍDA OBRIGATÓRIA

Retornar:

* preconditions_match
* initial_revision
* initial_tree_hash
* changed_path_count
* changed_paths
* migrations_created
* migrations_applied
* active_company_context_status
* server_membership_validation_status
* company_selector_status
* mobile_selector_status
* cache_isolation_status
* authenticated_routes_integrated_count
* queries_integrated_count
* mutations_integrated_count
* migrated_tables_covered_count
* uncovered_tenant_paths
* has_role_frontend_status
* has_role_backend_status
* matrix_branch_separation_status
* company_management_status
* invitation_internal_layer_status
* external_invitation_sent
* feature_flag_value
* multiempresa_publicly_visible
* single_company_regression_status
* cross_company_read_test
* cross_company_write_test
* unauthorized_role_test
* cache_residual_data_test
* typecheck_status
* build_status
* test_summary
* tests_not_executed_and_reason
* final_revision
* final_tree_hash
* working_tree_clean
* index_clean
* push_executed
* publication_performed
* wave_c_started
* final_decision
* next_gate

DECISÃO FINAL

Se a Wave B estiver implementada e pronta para preview humano:

final_decision =
VMEAP_WAVE_B_FUNCTIONAL_IMPLEMENTATION_COMPLETED

next_gate =
VMEAP_WAVE_B_PREVIEW_AND_HUMAN_VALIDATION

Se existir falha material:

final_decision =
VMEAP_WAVE_B_FUNCTIONAL_IMPLEMENTATION_BLOCKED

next_gate =
VMEAP_WAVE_B_TARGETED_CORRECTION

PARAR APÓS O RELATÓRIO.

NÃO ATIVAR A FEATURE FLAG PUBLICADA.
NÃO PUBLICAR.
NÃO INICIAR A WAVE C.
    </div>
  );
}
