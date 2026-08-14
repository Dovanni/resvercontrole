# Plan: Liberar CTA "Assinar Plano Empresarial" na Landing Page

Objetivo: Ativar o botão de assinatura do Plano Empresarial na landing page, integrando-o ao fluxo de autenticação e redirecionamento para a área de faturamento, preservando a segurança e o isolamento multitenant.

## User Review Required

> [!IMPORTANT]
> O fluxo redirecionará usuários deslogados para `/cadastro?intent=empresarial`. Após o cadastro e o login (via o `beforeLoad` da rota autenticada), o sistema deve encaminhar o usuário para `/configuracoes/assinatura`.

## Proposed Changes

### 1. Landing Content
- Atualizar `src/lib/plans.ts` (ou onde `PLANS` for definido, verificado em `src/lib/landing-content.ts`):
    - Mudar `ctaTarget` do plano empresarial de `"checkout"` para `"/configuracoes/assinatura"`.
    - Manter `available: true`.

### 2. UI Component (LandingPage)
- Modificar `PlanCard` em `src/components/landing/landing-page.tsx`:
    - Remover `disabled={true}` e a mensagem "Contratação online disponível em breve".
    - Adicionar mensagem "Contratação segura pela Stripe após entrar ou criar sua conta".
    - Implementar lógica de clique:
        - Se logado: `navigate({ to: "/configuracoes/assinatura" })`.
        - Se deslogado: `navigate({ to: "/cadastro", search: { intent: "empresarial" } })`.
    - Garantir acessibilidade (foco, teclado, contraste).

### 3. Redirecionamento Pós-Login
- Ajustar `src/routes/_authenticated.tsx` ou criar um mecanismo de captura da `intent`:
    - Verificar `URLSearchParams` ou um estado global para redirecionar usuários que vieram com `intent=empresarial` diretamente para a página de assinatura após o onboarding automático de empresa.

### 4. Cadastro
- Ajustar `src/routes/cadastro.tsx` para aceitar e propagar o parâmetro `intent` (opcionalmente via metadados ou apenas mantendo na URL para o próximo passo).

## Technical Details

- **Segurança**: Nenhuma lógica de Stripe (Price IDs, Secret Keys) será exposta na landing page. O redirecionamento apenas aponta para a rota autenticada que já possui o fluxo homologado.
- **Isolamento**: O `empresa_id` e permissões serão validados no servidor pelo fluxo de `/configuracoes/assinatura` já existente.
- **Acessibilidade**: Uso de componentes Shadcn `Button` que já suportam teclado e ARIA corretamente.

## Validation Plan

1. **Visitante Deslogado**: Clicar em "Assinar Plano Empresarial" -> Redirecionar para `/cadastro?intent=empresarial`.
2. **Fluxo de Cadastro**: Completar cadastro -> Login -> Redirecionar para `/configuracoes/assinatura`.
3. **Usuário Logado**: Clicar em "Assinar Plano Empresarial" -> Redirecionar direto para `/configuracoes/assinatura`.
4. **Verificações Visuais**: Confirmar remoção de badges "breve" e inclusão da nova mensagem de segurança.
5. **Responsividade**: Testar botão em mobile e desktop.
6. **Teclado**: Verificar se Enter/Espaço acionam o CTA.
