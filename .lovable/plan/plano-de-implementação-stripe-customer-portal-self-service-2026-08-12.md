# Plano de Implementação: Stripe Customer Portal Self-Service

Este plano descreve a implementação do portal de autoatendimento do Stripe no ecossistema VEJAMAIS, permitindo que assinantes gerenciem seus métodos de pagamento, consultem faturas e solicitem cancelamentos de forma segura e integrada.

## 1. Estado Atual
- **Infraestrutura**: Stripe Checkout funcional (Sandbox e Live).
- **Backend**: RLS ativo, multiempresa operando via `empresa_id`.
- **Tabelas**: `public.subscriptions` contém `stripe_customer_id` e `status`.
- **UI**: Rota `/configuracoes/assinatura` exibe status da assinatura e CTA de "Assinar Plano" para trialing.
- **Webhook**: Homologado para 7 eventos, incluindo `customer.subscription.updated` e `deleted`.

## 2. Arquitetura e Rotas

### Novas Rotas e Arquivos
- `src/routes/api/public/billing/create-portal-session.tsx`: Endpoint HTTP POST autenticado para gerar a URL do portal.
- `src/lib/billing-portal.server.ts`: Lógica server-side para interação com a API do Stripe (Portal Sessions).
- `src/lib/billing.functions.ts`: Função de transporte client-side `createStripePortalSession`.

### Fluxo de Dados
1. O cliente clica em "Gerenciar assinatura e pagamentos".
2. O frontend chama `POST /api/public/billing/create-portal-session` enviando `empresaId`.
3. O servidor valida:
   - Autenticação do usuário (Bearer token).
   - Vínculo do usuário com a empresa (`user_company_access`).
   - Existência de `stripe_customer_id` na tabela `subscriptions` da empresa.
4. O servidor identifica o ambiente (Sandbox/Live) via host.
5. O Stripe é chamado para criar a Portal Session com `return_url` segura.
6. A URL é retornada e o frontend redireciona o usuário.

## 3. Segurança e Permissões

### Permissão Mínima `rk_live_`
A restricted key de produção (`rk_live_`) precisará de uma permissão adicional:
- **Customer Portal Sessions**: `Write`

**AUDITORIA**: Atualmente, a chave `rk_live_` configurada para o Checkout não possui esta permissão. Será necessário ajuste manual via Dashboard do Stripe antes da ativação em produção.

### Proteções
- **IDOR**: O `stripe_customer_id` nunca é aceito via input; é obtido via consulta interna vinculada ao `empresaId` validado.
- **Ambiente**: Separação total de segredos Test/Live.
- **Clique Duplo**: Estado de loading no botão e desativação imediata após o clique.
- **CSRF/Origem**: Validação rigorosa de `Origin` e `Host` via `isValidOrigin`.

## 4. Mudanças na Interface (UI)

### Componente `SubscriptionSettingsPage`
- **Lógica de Exibição**:
  - Se `sub.status === 'active'` ou `sub.status === 'past_due'`: Exibir botão "Gerenciar assinatura e pagamentos".
  - Se `sub.status === 'canceled'` mas ainda dentro do período (`current_period_end > now`): Exibir badge "Cancelamento agendado — acesso disponível até DD/MM/AAAA".
- **Botão de Gestão**: Redireciona para o portal seguro.

## 5. Plano de Testes
1. **Autenticação**: Tentar criar sessão sem token (401).
2. **Cross-Company**: Tentar acessar portal de uma empresa B estando logado e vinculado apenas à empresa A (403).
3. **Customer Ausente**: Tentar acessar portal para empresa sem assinatura/customer criado (404/Erro amigável).
4. **Ambiente**: Garantir que o portal Live nunca seja aberto em ambiente de Preview (Sandbox).
5. **Retorno Seguro**: Validar que ao sair do portal, o usuário volta exatamente para `/configuracoes/assinatura`.
6. **Cancelamento Agendado**: Simular `customer.subscription.updated` via webhook com `cancel_at_period_end=true` e verificar se a UI reflete a data correta.

## 6. Decisão de Prontidão
**Estado**: `READY_FOR_READ_ONLY_VALIDATION`

O sistema possui todos os pré-requisitos técnicos. A implementação pode prosseguir assim que a permissão da chave restrita for confirmada.

---
*PROIBIÇÃO ATIVA: Nenhuma assinatura foi alterada. Nenhuma API de escrita foi chamada.*
