// Centralized content for the public landing page.
// Edit copy, plans and external URLs here — components consume this module.

export const METRIXHR_URL = "https://metrixhr.com.br";
export const VEJAMAIS_DOMAIN = "https://vejamais.com.br";

export const HERO = {
  eyebrow: "Gestão Comercial e Financeira",
  title: "Pare de administrar sua empresa no escuro.",
  subtitle:
    "Centralize vendas, produtos, clientes, fornecedores, contas, fluxo de caixa, custos e resultados em uma plataforma simples, segura e preparada para apoiar decisões mais conscientes.",
  primaryCta: "Entrar",
  secondaryCta: "Conhecer o Vejamais",
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
  { title: "Evolução futura multiempresa", desc: "Arquitetura preparada para novos cenários." },
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
  { name: "Vendas", desc: "Registre e acompanhe cada venda com clareza." },
  { name: "Produtos", desc: "Catálogo organizado com atributos essenciais." },
  { name: "Financeiro", desc: "Visão consolidada da saúde do negócio." },
  { name: "Fluxo de caixa", desc: "Entradas e saídas em uma linha do tempo." },
  { name: "Contas", desc: "A pagar e a receber, sob controle." },
  { name: "Relatórios", desc: "Análises e exportações práticas." },
  { name: "BI", desc: "Indicadores para decisão consciente." },
  { name: "Lucro", desc: "Auditoria de resultado por operação." },
  { name: "Clientes", desc: "Histórico e relacionamento em um lugar." },
  { name: "Fornecedores", desc: "Cadastro e vínculos organizados." },
];

export type Plan = {
  id: string;
  name: string;
  description: string;
  priceMonthly: string; // placeholder controlado — nunca inventar valor comercial
  priceYearly?: string;
  users: string;
  companies: string;
  features: string[];
  support: string;
  cta: string;
  ctaTarget: "/auth" | "contato";
  recommended?: boolean;
  available: boolean;
};

// Placeholders administrativos claramente identificados — não publicar valores fictícios.
const PRICE_TBD = "A definir";

export const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "Essencial",
    description: "Para quem precisa organizar a operação comercial e financeira.",
    priceMonthly: PRICE_TBD,
    users: "A definir",
    companies: "1 empresa",
    features: [
      "Vendas, compras e produtos",
      "Clientes e fornecedores",
      "Contas a pagar e receber",
      "Fluxo de caixa básico",
    ],
    support: "Suporte por e-mail",
    cta: "Criar minha conta",
    ctaTarget: "/auth",
    available: true,
  },
  {
    id: "profissional",
    name: "Profissional",
    description: "Para empresas que precisam de mais controle, relatórios e usuários.",
    priceMonthly: PRICE_TBD,
    users: "A definir",
    companies: "1 empresa",
    features: [
      "Tudo do Essencial",
      "Relatórios avançados",
      "Curva ABC e controle de vendas",
      "Balancete e despesas anuais",
    ],
    support: "Suporte prioritário",
    cta: "Criar minha conta",
    ctaTarget: "/auth",
    recommended: true,
    available: true,
  },
  {
    id: "empresarial",
    name: "Empresarial",
    description: "Para operações mais completas e equipes em crescimento.",
    priceMonthly: PRICE_TBD,
    users: "A definir",
    companies: "1 empresa",
    features: [
      "Tudo do Profissional",
      "Business Intelligence",
      "Auditoria de lucro",
      "Cartões e contas bancárias",
    ],
    support: "Suporte dedicado",
    cta: "Falar com o time",
    ctaTarget: "contato",
    available: true,
  },
  {
    id: "multiempresa",
    name: "Multiempresa",
    description: "Para administração futura de mais de uma empresa.",
    priceMonthly: PRICE_TBD,
    users: "A definir",
    companies: "Múltiplas empresas",
    features: [
      "Arquitetura preparada para evolução multiempresa",
      "Recurso não disponível nesta versão",
      "Liberação sujeita à homologação técnica",
    ],
    support: "Sob consulta",
    cta: "Tenho interesse",
    ctaTarget: "contato",
    available: false,
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
