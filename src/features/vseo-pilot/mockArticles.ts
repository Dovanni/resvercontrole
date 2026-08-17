
export interface MockArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  publishedAt: string;
  updatedAt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  relatedKeywords: string[];
  imageAlt: string;
  status: 'draft' | 'published';
  visibility: 'public' | 'private';
}

export const MOCK_ARTICLES: MockArticle[] = [
  {
    id: '1',
    slug: 'como-organizar-fluxo-de-caixa-e-commerce',
    title: 'Como organizar o fluxo de caixa de um e-commerce',
    excerpt: 'Aprenda as melhores práticas para gerir as entradas e saídas do seu comércio eletrônico com eficiência.',
    content: `
      <h2>Introdução ao Fluxo de Caixa</h2>
      <p>Gerir um e-commerce exige atenção constante às movimentações financeiras. O fluxo de caixa é a ferramenta vital para garantir que sua empresa tenha liquidez.</p>
      
      <h3>Entradas e Saídas</h3>
      <p>O registro meticuloso de cada venda e de cada despesa operacional é o primeiro passo para o sucesso. Sem isso, a previsibilidade financeira torna-se impossível.</p>
      
      <h3>Visão Consolidada com VEJAMAIS</h3>
      <p>Utilizar uma plataforma que oferece visão consolidada permite identificar gargalos e oportunidades de investimento em tempo real. O VEJAMAIS ajuda a centralizar essas informações, permitindo que você foque no crescimento do negócio.</p>
    `,
    category: 'Financeiro',
    tags: ['fluxo de caixa', 'e-commerce', 'gestão'],
    author: 'Equipe Editorial VEJAMAIS — Conteúdo Piloto',
    publishedAt: '2026-08-17T10:00:00Z',
    updatedAt: '2026-08-17T10:00:00Z',
    metaTitle: 'Como Organizar Fluxo de Caixa para E-commerce | VEJAMAIS',
    metaDescription: 'Guia prático sobre gestão de entradas, saídas e previsibilidade financeira para e-commerce. Veja como centralizar informações com VEJAMAIS.',
    focusKeyword: 'fluxo de caixa e-commerce',
    relatedKeywords: ['gestão financeira', 'contas a pagar', 'previsibilidade'],
    imageAlt: 'Gráfico representativo de fluxo de caixa em e-commerce',
    status: 'draft',
    visibility: 'public',
  },
  {
    id: '2',
    slug: 'como-evitar-divergencias-estoque',
    title: 'Como evitar divergências no estoque da sua empresa',
    excerpt: 'Dicas fundamentais para manter o inventário sempre atualizado e evitar prejuízos com falta ou excesso de produtos.',
    content: `
      <h2>O Desafio da Gestão de Estoque</h2>
      <p>Divergências entre o estoque físico e o sistema podem causar grandes transtornos operacionais e financeiros.</p>
      
      <h3>Registro de Compras e Movimentações</h3>
      <p>Cada entrada de mercadoria deve ser registrada imediatamente. A conferência rigorosa no momento do recebimento previne erros em cascata.</p>
      
      <h3>Prevenção de Duplicidades</h3>
      <p>O VEJAMAIS utiliza mecanismos de proteção contra duplicidades no registro de compras, garantindo que seu estoque reflita a realidade física da empresa. Indicadores operacionais claros ajudam a manter o controle total.</p>
    `,
    category: 'Operacional',
    tags: ['estoque', 'inventário', 'compras'],
    author: 'Equipe Editorial VEJAMAIS — Conteúdo Piloto',
    publishedAt: '2026-08-17T11:00:00Z',
    updatedAt: '2026-08-17T11:00:00Z',
    metaTitle: 'Gestão de Estoque: Evite Divergências | VEJAMAIS',
    metaDescription: 'Descubra como manter seu estoque fiel à realidade. Dicas sobre registro de compras e prevenção de duplicidades com VEJAMAIS.',
    focusKeyword: 'divergências no estoque',
    relatedKeywords: ['gestão de inventário', 'indicadores operacionais', 'compras'],
    imageAlt: 'Depósito organizado com prateleiras e etiquetas',
    status: 'draft',
    visibility: 'public',
  },
  {
    id: '3',
    slug: 'gestao-multiempresa-centralizar-informacoes',
    title: 'Gestão multiempresa: como centralizar informações com segurança',
    excerpt: 'Estratégias para administrar múltiplas unidades de negócio sem perder o controle e garantindo o isolamento de dados.',
    content: `
      <h2>Crescendo com Múltiplas Empresas</h2>
      <p>Administrar mais de um CNPJ traz complexidades únicas, especialmente no que tange à organização administrativa.</p>
      
      <h3>Isolamento e Segurança</h3>
      <p>O isolamento entre empresas é crítico. Cada unidade deve ter seus dados protegidos, enquanto a gestão central mantém a visão consolidada necessária para a tomada de decisão.</p>
      
      <h3>Papéis e Permissões no VEJAMAIS</h3>
      <p>Com o sistema multiempresa do VEJAMAIS, você define papéis e permissões específicos para cada usuário em cada empresa, garantindo que a informação certa esteja nas mãos das pessoas certas com total segurança.</p>
    `,
    category: 'Administrativo',
    tags: ['multiempresa', 'segurança', 'gestão'],
    author: 'Equipe Editorial VEJAMAIS — Conteúdo Piloto',
    publishedAt: '2026-08-17T12:00:00Z',
    updatedAt: '2026-08-17T12:00:00Z',
    metaTitle: 'Gestão Multiempresa Segura e Centralizada | VEJAMAIS',
    metaDescription: 'Saiba como centralizar a gestão de várias empresas com segurança. Entenda o isolamento de dados e papéis no VEJAMAIS.',
    focusKeyword: 'gestão multiempresa',
    relatedKeywords: ['isolamento de dados', 'visão consolidada', 'permissões'],
    imageAlt: 'Painel de controle exibindo múltiplas unidades de negócio',
    status: 'draft',
    visibility: 'public',
  },
];
