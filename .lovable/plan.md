# Plano de Implementação: Monetização Definitiva VEJAMAIS (Fases 1-7)

## Objetivo
Implementar a infraestrutura de monetização recorrente em produção (Live) separada do Sandbox, garantindo segurança, idempotência e conformidade com o Protocolo VEJAMAIS_STRIPE_DEFINITIVE_MONETIZATION_IMPLEMENTATION.

## Etapas Técnicas

### 1. Infraestrutura de Webhooks (Fase 1 e 4)
- **Criação da Rota Live**: Implementar `/api/public/stripe-webhook/live` com lógica compartilhada de `stripe-webhook.ts`.
- **Separação de Segredos**: Mapear `STRIPE_WEBHOOK_SECRET_LIVE` e `STRIPE_RESTRICTED_KEY_LIVE`.
- **Validação de Modo**: Rota original rejeita `livemode=true`; Rota Live rejeita `livemode=false`.
- **Processamento Atômico**: Integrar com RPCs Supabase para processamento idempotente baseado em `provider_event_id` e `livemode`.

### 2. Checkout Canônico por Ambiente (Fase 3)
- **Autoridade Server-Side**: `createStripeCheckoutSessionImpl` em `src/lib/billing.server.ts` passará a derivar o Price ID e o ambiente (Test/Live) exclusivamente de variáveis de ambiente e do hostname de produção.
- **Remoção de Bloqueios de Preview**: Permitir checkout em `vejamais.com.br` quando `STRIPE_LIVE_BILLING_ENABLED=true`.
- **Persistência Obrigatória**: Garantir que o `session_id` seja persistido antes do redirecionamento.

### 3. Gerenciamento de Segredos (Fase 2)
- Normalizar o acesso a segredos no servidor, garantindo que nenhum segredo `VITE_` seja exposto ou vazado para o bundle do cliente.

### 4. Política de Acesso e Gate (Fase 5)
- Implementar verificação de status da assinatura (trialing, active, past_due, etc.) sem ativar o hard gate global imediatamente.

### 5. Validação e Testes (Fase 6)
- Executar suíte de 110 testes + novos testes de separação Test/Live.
- Validar builds de produção e integridade da Homepage.

## Detalhes para o Usuário
O sistema agora terá dois "ouvidos" para a Stripe: um para testes e outro para pagamentos reais. O browser não terá controle sobre preços ou modos, garantindo que ninguém possa alterar o valor da assinatura. Nenhuma cobrança real será feita sem que você configure o segredo Live na próxima etapa manual.
