// Centralized content for the public landing page.
// Edit copy, plans and external URLs here — components consume this module.

export const METRIXHR_URL = "https://metrixhr.com.br";
export const VEJAMAIS_DOMAIN = "https://vejamais.com.br";

export const HERO = {
  eyebrow: "Planos",
  title: "Comece gratuitamente e continue crescendo com o VEJAMAIS.",
  subheadline:
    "Tenha acesso completo por 30 dias. Depois, continue com o Plano Empresarial por R$ 35,90 ao mês.",
  subtitle:
    "Centralize pedidos, vendas, produtos, estoque, taxas, fretes, contas, margens e lucros em um só lugar — com clareza para decidir e segurança para crescer.",
  primaryCta: "Começar agora",
  secondaryCta: "Conhecer o VEJAMAIS",
  existingClientCta: "Já sou cliente — Entrar",
};


export const PAIN_POINTS = [
  "Vendas registradas em lugares diferentes",
  "Planilhas desatualizadas e frágeis",
  "Contas a pagar e receber sem acompanhamento",
  "Dificuldade para saber quanto realmente lucrou",
  "Custos, taxas, juros e fretes esquecidos",
  "Estoque e produtos sem visão clara",
  "Informações financeiras dispersas",
  "Relatórios demorados e imprecisos",
  "Falta de visão do fluxo de caixa",
  "Decisões baseadas em memória ou suposição",
  "Dificuldade para acompanhar clientes e fornecedores",
  "Ausência de visão consolidada do negócio",
];

export const MODULES = [
  { name: "Dashboard", desc: "Visão consolidada do dia a dia." },
  { name: "Vendas", desc: "Registro e acompanhamento de vendas." },
  { name: "Compras", desc: "Controle de compras e insumos." },
  { name: "Produtos", desc: "Cadastro e organização do catálogo." },
  { name: "Clientes", desc: "Base de clientes centralizada." },
  { name: "Fornecedores", desc: "Cadastro e relacionamento." },
  { name: "Contas a pagar", desc: "Compromissos com prazos claros." },
  { name: "Contas a receber", desc: "Recebimentos organizados." },
  { name: "Contas bancárias", desc: "Movimentações e conciliação." },
  { name: "Cartões de crédito", desc: "Faturas e lançamentos." },
  { name: "Financeiro", desc: "Consolidação financeira." },
  { name: "Fluxo de caixa", desc: "Entradas e saídas no tempo." },
  { name: "Balancete", desc: "Consulta contábil resumida." },
  { name: "Relatórios", desc: "Exportações e análises." },
  { name: "Curva ABC", desc: "Priorização por relevância." },
  { name: "Controle de vendas", desc: "Acompanhamento diário." },
  { name: "Despesas anuais", desc: "Planejamento e comparativo." },
  { name: "Business Intelligence", desc: "Indicadores para decisão." },
  { name: "Auditoria de lucro", desc: "Revisão de resultados." },
];

export const BENEFITS = [
  { title: "Visão centralizada", desc: "Tudo em um único lugar, do comercial ao financeiro." },
  { title: "Organização comercial", desc: "Vendas, produtos, clientes e fornecedores estruturados." },
  { title: "Acompanhamento financeiro", desc: "Contas, movimentações e conciliações no seu ritmo." },
  { title: "Melhor compreensão do lucro", desc: "Custos, taxas e resultado real por operação." },
  { title: "Controle de contas", desc: "Compromissos e recebimentos com prazos claros." },
  { title: "Fluxo de caixa", desc: "Entradas e saídas em uma linha do tempo." },
  { title: "Relatórios e indicadores", desc: "Informação para apoiar decisões." },
  { title: "Menos dependência de planilhas", desc: "Rotinas mais consistentes e menos retrabalho." },
  { title: "Acesso responsivo", desc: "Desktop, tablet e celular." },
  { title: "Segurança e rastreabilidade", desc: "Ações registradas e acesso controlado." },
  { title: "Multiempresa ativo", desc: "Arquitetura preparada para evolução multiempresa." },
];

export const HOW_IT_WORKS = [
  "Crie sua conta.",
  "Cadastre sua empresa.",
  "Configure produtos, clientes e fornecedores.",
  "Registre vendas, compras e movimentações.",
  "Acompanhe contas e fluxo de caixa.",
  "Analise indicadores e tome decisões com mais clareza.",
];

export const FEATURED_RESOURCES = [
  { name: "Pedidos e vendas", desc: "Registre e acompanhe cada pedido e venda com clareza." },
  { name: "Produtos e estoque", desc: "Catálogo organizado e visão das quantidades." },
  { name: "Clientes e fornecedores", desc: "Relacionamento, histórico e compras no mesmo lugar." },
  { name: "Contas e fluxo de caixa", desc: "A pagar, a receber e entradas e saídas no tempo." },
  { name: "Custos, margens e lucros", desc: "Taxas, fretes e custos refletidos no resultado." },
  { name: "Relatórios e DRE", desc: "Análises comerciais e financeiras com DRE por competência." },
];


export type Plan = {
  id: string;
  badge?: string;
  name: string;
  description: string;
  priceDisplay: string;
  priceMonthly?: number;
  pricePeriod?: string;
  complement?: string;
  users: string;
  companies: string;
  features: string[];
  support: string;
  cta: string;
  ctaTarget: "/cadastro" | "checkout";
  recommended?: boolean;
  available: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "essencial",
    badge: "30 DIAS GRÁTIS",
    name: "Essencial",
    description: "Experimente todos os recursos do VEJAMAIS para organizar e acompanhar sua gestão comercial e financeira.",
    priceDisplay: "Grátis por 30 dias",
    complement: "Sem cartão para começar",
    users: "Até 5 usuários",
    companies: "Multiempresa ativo",
    features: [
      "Todos os recursos",
      "Gestão comercial e financeira",
      "Relatórios avançados, BI e DRE",
      "Auditoria de lucro",
    ],
    support: "Suporte prioritário",
    cta: "Começar avaliação gratuita",
    ctaTarget: "/cadastro",
    available: true,
  },
  {
    id: "empresarial",
    badge: "CONTINUIDADE COMPLETA",
    name: "Empresarial",
    description: "Continue utilizando todos os recursos do VEJAMAIS após o período de avaliação.",
    priceDisplay: "R$ 35,90",
    pricePeriod: "por mês",
    users: "Até 5 usuários",
    companies: "Multiempresa ativo",
    features: [
      "Todos os recursos",
      "Gestão comercial e financeira",
      "Relatórios avançados, BI e DRE",
      "Auditoria de lucro",
      "Continuidade sem interrupção",
    ],
    support: "Suporte prioritário",
    cta: "Assinar Plano Empresarial",
    ctaTarget: "/configuracoes/assinatura",
    recommended: true,
    available: true,
  },
];

export const SECURITY = {
  title: "Os dados da sua empresa pertencem à sua empresa.",
  points: [
    "Isolamento entre empresas",
    "Acesso conforme vínculo e permissão",
    "Princípio do menor privilégio",
    "Proteção de autenticação",
    "LGPD by design e by default",
    "Acesso cross-tenant negado por padrão",
    "Sem acesso automático indiscriminado pelo proprietário da plataforma",
    "Auditoria de ações administrativas",
    "Suporte excepcional justificado e auditado",
    "Proteção de dados pessoais e financeiros",
    "Proibição de compartilhamento indevido",
  ],
};

export const FAQ = [
  {
    q: "O que é o Vejamais?",
    a: "Uma plataforma de gestão comercial e financeira para centralizar vendas, compras, contas, fluxo de caixa e resultados do seu negócio.",
  },
  {
    q: "O Vejamais substitui minhas planilhas?",
    a: "O Vejamais reduz a dependência de planilhas ao concentrar as informações comerciais e financeiras em rotinas estruturadas.",
  },
  {
    q: "Posso controlar contas a pagar e receber?",
    a: "Sim. Contas a pagar, contas a receber, contas bancárias e cartões estão entre os módulos disponíveis.",
  },
  {
    q: "Consigo acompanhar meu lucro?",
    a: "O Vejamais oferece auditoria de lucro, relatórios e indicadores que apoiam a análise de resultado.",
  },
  {
    q: "Posso cadastrar produtos, clientes e fornecedores?",
    a: "Sim. Há módulos dedicados para produtos, clientes e fornecedores.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. A interface é responsiva e funciona em desktop, tablet e celular.",
  },
  {
    q: "Meus dados ficam separados dos dados de outras empresas?",
    a: "Sim. A arquitetura aplica isolamento por empresa e acesso conforme vínculo e permissão.",
  },
  {
    q: "O proprietário da plataforma acessa automaticamente meus dados?",
    a: "Não. Não há acesso automático indiscriminado. Acessos excepcionais de suporte são justificados e auditados.",
  },
  {
    q: "Posso mudar de plano?",
    a: "Sim. As condições de mudança serão informadas junto às regras comerciais formalizadas.",
  },
  {
    q: "Posso cancelar?",
    a: "Sim. As condições de cancelamento serão informadas junto às regras comerciais formalizadas.",
  },
  {
    q: "O recurso multiempresa já está disponível?",
    a: "A arquitetura está preparada para evolução multiempresa. A liberação ocorrerá quando a funcionalidade estiver tecnicamente homologada.",
  },
  {
    q: "Qual a relação entre Vejamais e Metrixhr?",
    a: "Vejamais e Metrixhr são soluções complementares. O Vejamais atua na organização comercial e financeira. O Metrixhr atua na gestão com inteligência humanizada de vendas, desempenho e desenvolvimento das pessoas. Não existe compartilhamento automático de dados ou sessão entre as plataformas.",
  },
];
