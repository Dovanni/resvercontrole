# Ativação do Checkout Live — VEJAMAIS

Este plano ativa controladamente o botão de Checkout Live no domínio oficial (`www.vejamais.com.br`), garantindo que a decisão de ambiente (Live/Sandbox) permaneça exclusivamente no servidor e que o ambiente de Preview/Sandbox continue isolado.

## Etapas

1. **Auditoria de Precondições (Strict Read-Only)**:
   - Verificar `STRIPE_LIVE_BILLING_ENABLED` e outras flags.
   - Confirmar se o hostname e origin estão corretos.
   - Identificar a causa exata do bloqueio atual no botão.

2. **Refatoração da Lógica de Habilitação do CTA**:
   - Criar `src/lib/billing-status.functions.ts` para prover o estado de habilitação vindo do servidor.
   - Criar o hook `useCheckoutStatus` para consumir esse estado.
   - Atualizar a página de assinatura para usar o estado do servidor em vez de lógica hardcoded no client.

3. **Ativação Server-Side**:
   - Configurar `STRIPE_LIVE_BILLING_ENABLED=true` (via ferramenta de secrets se necessário, ou simulando no código se for uma flag de aplicação).
   - Garantir que apenas o domínio oficial use o modo Live.

4. **Ajuste da Interface (UI)**:
   - Remover mensagem de "modo de teste" em produção.
   - Adicionar aviso "Pagamento seguro processado pela Stripe".
   - Implementar proteção contra clique duplo.
   - Mostrar estado de redirecionamento.

5. **Validação e Testes**:
   - Executar suíte de 131 testes.
   - Adicionar testes específicos para as novas condições de habilitação.

## Detalhes Técnicos

### Trava Identificada
A trava atual está no arquivo `src/routes/_authenticated.configuracoes.assinatura.tsx` (linhas 149-153):
```typescript
const isCtaEnabled = 
  hostname === ALLOWED_PREVIEW_HOST && 
  origin === ALLOWED_PREVIEW_ORIGIN && 
  isF958 && 
  isTrialing;
```
Esta condição bloqueia explicitamente o domínio oficial.

### Mudanças Propostas
- **Backend**: `getCheckoutStatus` server function para centralizar a autoridade.
- **Frontend**: `SubscriptionSettingsPage` usará `checkoutStatus.data?.checkout_enabled` para habilitar o botão.
- **Segurança**: Browser nunca envia `price_id`, `amount` ou `livemode`.

## Escopo Proibido
- Não criar sessões Stripe durante a implementação.
- Não alterar migrations ou tabelas.
- Não expor secrets no bundle do cliente.
