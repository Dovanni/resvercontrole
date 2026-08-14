# Plano de Preparação Segura do Checkout Stripe - Fase 1 Sandbox

Este plano estabelece as bases técnicas para o checkout do Plano Empresarial no ambiente Sandbox, garantindo segregação absoluta, segurança multi-tenant e idempotência, sem afetar o ambiente de produção real.

## 1. Segregação de Ambientes
*   **Sandbox**: Utilização exclusiva de chaves `sk_test_`, `pk_test_` ou `rk_test_`, Price IDs de teste e cartões de teste Stripe.
*   **Live**: Bloqueado via flag `STRIPE_LIVE_CHECKOUT_ENABLED=false` e validações de host (`www.vejamais.com.br`).
*   **Secrets**: Configuração de segredos via cofre seguro (Add Secret) para chaves de teste e Live separadamente.

## 2. Configuração Canônica do Plano Empresarial (Servidor)
*   **Plano**: Empresarial (Vejamais)
*   **Valor**: R$ 35,90 (3590 centavos)
*   **Recorrência**: Mensal
*   **Limite**: Até 5 usuários
*   **Trial**: 30 dias (utilizando período canônico da empresa via banco).

## 3. Implementação Técnica
*   **Checkout Session (Server-Only)**:
    *   Criação exclusiva no servidor via RPC `reserve_checkout_attempt` e `finalize_checkout_attempt_v2`.
    *   Uso de transporte REST direto (`fetch`) para maior controle e observabilidade.
    *   Idempotência baseada no ID da tentativa de checkout.
*   **Webhooks (Server-Only)**:
    *   Endpoints dedicados para Sandbox (`/api/public/stripe-webhook`) e Live (`/api/public/stripe-webhook/live`).
    *   Validação de assinatura Stripe obrigatória.
    *   Processamento atômico de eventos (`checkout.session.completed`, `invoice.paid`, etc.).
*   **Portal do Cliente**:
    *   Integração segura via servidor para gestão de assinatura e faturas.

## 4. Segurança e Autorização
*   **IDOR Protection**: Validação do `empresa_id` e membership admin no servidor antes de qualquer ação financeira.
*   **Bundle Audit**: Garantia de que segredos (`sk_*`) e lógica privada nunca vazem para o cliente.
*   **Success Page**: A página de sucesso não concede o plano; a autoridade final é o webhook validado.

## Detalhes Técnicos

### Arquivos e Mudanças
*   `src/lib/billing.server.ts`: Refinar lógica de criação de sessão para suportar trial canônico e configurações de Sandbox.
*   `src/routes/_authenticated.configuracoes.assinatura.tsx`: Atualizar interface para exibir estado de Sandbox e bloquear Live.
*   `src/lib/billing-status.server.ts`: Ajustar flags de ambiente e motivos de bloqueio.
*   `src/routes/api/public/billing/*`: Endurecer endpoints de context e checkout.

### Protocolo de Validação (T01-T30)
*   Testes automatizados e manuais cobrindo anônimos, cross-tenant, manipulação de preços, idempotência e falhas de pagamento no Sandbox.

**Nota**: Nenhuma alteração no banco de dados compartilhado, RLS ou GRANTs será realizada nesta fase.
