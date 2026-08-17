# VEJAMAIS ERP Global Brand Display Pilot v1.0

Implementação cirúrgica do padrão oficial da marca `VEJAMAIS ERP` em toda a aplicação, inicialmente em regime de preview para homologação visual.

## Precondições
- Homepage comercial legítima confirmada (SHA-256: `373abfad...`).
- Ausência de relatórios técnicos ou manifestos VSEO na branch `main`.
- Branch `feature/vseo-mock-pilot-v1` preservada isoladamente.
- Working tree limpa.

## Alterações Propostas

### 1. Centralização da Marca
- Atualizar metadados de branding no `src/routes/__root.tsx` (Head Content).
- Atualizar metadados SEO e Open Graph em `src/routes/index.tsx`.

### 2. Identidade Visual (Logo e Wordmark)
- Atualizar o componente `src/components/vejamais-logo.tsx` para incluir "ERP" no wordmark textual e no `aria-label`.
- Garantir que a tipografia e o alinhamento do "ERP" sigam o padrão visual estabelecido.

### 3. Conteúdo da Landing Page
- Atualizar `src/lib/landing-content.ts` para refletir o novo nome comercial em títulos, descrições, CTAs e FAQ.
- Manter o domínio `vejamais.com.br` e URLs técnicas inalterados.

### 4. Interface da Aplicação (Dashboard e Autenticação)
- Atualizar `src/components/app-shell.tsx` (Cabeçalho e Sidebar).
- Atualizar páginas de Login (`src/routes/login.tsx`), Cadastro (`src/routes/cadastro.tsx`), Recuperação (`src/routes/recuperar-senha.tsx`) e Reset (`src/routes/reset-password.tsx`).
- Atualizar Banner de Avaliação (`src/components/trial-banner.tsx`) e Ativação (`src/routes/ativar-conta.tsx`).
- Atualizar metadados das páginas autenticadas (ex: `minha-empresa`).

### 5. PWA e Acessibilidade
- Atualizar `public/manifest.json` com o novo nome comercial.
- Atualizar `aria-label` e `alt` em todos os componentes de logo.

## Elementos Protegidos (NÃO ALTERAR)
- URLs, Slugs e Domínios.
- Identificadores técnicos (IDs Supabase, chaves de ambiente, nomes de tabelas/colunas).
- Razão Social e dados jurídicos.
- Branches históricas e registros forenses.

## Validação e Verificação
- Busca global pós-implementação para garantir 0 ocorrências de `VEJAMAIS` sem `ERP` em áreas públicas.
- Typecheck, Lint e Build de produção.
- Inspeção visual (Playwright) em Desktop e Mobile.
- Verificação de acessibilidade e metadados SEO/JSON-LD.
