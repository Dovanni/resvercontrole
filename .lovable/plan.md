# Plano de Refinamento Visual da Página de Cadastro — Ecossistema Unificado

Refinar o layout de `src/routes/cadastro.tsx` para criar um ecossistema visual centralizado e coeso em torno do formulário, integrando canais próprios e marketplaces em uma grade de três colunas (desktop).

## Alterações Propostas

### 1. Estrutura de Grade Centralizada (Desktop)
- Criar um container principal com `max-w-[1180px]` centralizado.
- Implementar grade de 3 colunas no desktop:
  - **Esquerda (240-260px)**: Card "Seu negócio, seus canais".
  - **Centro (500-540px)**: Formulário de cadastro (protagonista).
  - **Direita (240-280px)**: Card "Marketplaces e serviços".
- Usar `items-start` para alinhamento superior.
- Garantir que as colunas pareçam parte da mesma experiência (bordas, sombras, fundo suave).

### 2. Coluna Esquerda — Operação Própria
- Título: "Seu negócio, seus canais".
- Destaque "Meu e-commerce" (Loja virtual própria) com verde VEJAMAIS.
- Lista de outros canais: Loja física, Redes sociais, Venda direta.
- Mensagem de valor: "Centralize o acompanhamento comercial e financeiro dos canais que pertencem ao seu negócio."
- Melhorar contraste para garantir legibilidade.

### 3. Coluna Direita — Marketplaces e Serviços
- Título: "Marketplaces e serviços".
- Subtítulo: "Registre e acompanhe os resultados das vendas realizadas em diferentes plataformas."
- Grade de chips (2 colunas): Mercado Livre, Amazon, Shopee, Magalu, SHEIN, Temu.
- Seção "Serviço de pagamento" abaixo com o chip "Mercado Pago".
- Manter chips neutros e elegantes (sem logotipos, apenas cores discretas).
- Aviso legal ao final do card.

### 4. Botão de Ajuda Refinado
- Substituir o ícone isolado por um botão pill/texto: "Como funciona esta etapa?".
- Posicionamento estratégico próximo ao subtítulo institucional.
- Manter acessibilidade e modal existente.

### 5. Responsividade e Hierarquia
- **Tablet**: Formulário em cima, cards laterais abaixo lado a lado.
- **Mobile**: Fluxo vertical (Marca -> Ajuda -> Intro -> Formulário -> Canais Próprios -> Marketplaces -> Rodapé).
- Chips em 2 colunas no mobile quando houver largura.
- Zero rolagem horizontal.

## Detalhes Técnicos
- **CSS**: Utilizar Tailwind CSS v4 com variáveis de tema.
- **Iconografia**: Lucide-react.
- **Componentes**: Reuso de `Card`, `Button`, `Dialog` da UI local.
- **Acessibilidade**: Garantir `aria-haspopup`, contraste AA, e preservação do foco.

## Verificação
- Executar build de produção.
- Testar viewports: 1440px, 1180px, 768px, 390px.
- Validar contraste e fluxos de teclado.
