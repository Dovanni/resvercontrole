# Plano de Implementação: Suporte WhatsApp na Homepage Pública

Este plano descreve a ativação do suporte via WhatsApp na homepage pública do VEJAMAIS, mantendo a consistência com as áreas autenticadas.

## Mudanças

### Frontend

- **Homepage Pública (`src/routes/index.tsx`)**: Importação e renderização do componente `WhatsAppSupport` com a mensagem personalizada: "Olá! Gostaria de conhecer melhor o VEJAMAIS."
- **Consistência Visual**: O botão será exibido de forma fixa no canto inferior direito, respeitando o layout e a responsividade em desktop e mobile.

## Verificação e Segurança

### Testes Automatizados
- Execução da suíte `tests/whatsapp-support.test.ts` para garantir que o componente funciona corretamente.
- Verificação de build (`build:dev`) para garantir que não há conflitos de rotas.

### Segurança e Integridade
- **Isolamento**: Nenhuma alteração no fluxo de autenticação, banco de dados ou RPCs do Stripe.
- **Privacidade**: Uso exclusivo do protocolo `https://wa.me/` sem scripts de terceiros.

## Detalhes Técnicos

- **Componente**: `src/components/WhatsAppSupport.tsx`
- **Mensagem**: Codificada corretamente para a URL do WhatsApp.
- **Z-Index**: Ajustado para não sobrepor elementos críticos de navegação.
