# PROTOCOLO: VEJAMAIS_STRIPE_EDGE_FUNCTION_DEPLOYMENT_V1

## Instruções de Implantação Manual (Supabase Dashboard)

### 1. Criação da Função
1. Acesse o **Supabase Dashboard** > **Edge Functions**.
2. Clique em **Create a new function**.
3. Nome: \`stripe-webhook\`.

### 2. Configuração de Secrets
NÃO utilize os secrets do Lovable. Configure os seguintes no Supabase:
- \`STRIPE_RESTRICTED_KEY\`: Chave restrita do Stripe (rk_test_...).
- \`STRIPE_WEBHOOK_SECRET\`: Segredo de assinatura (whsec_...).
- \`STRIPE_PRICE_ENTERPRISE_MONTHLY\`: ID do preço no Stripe.

*Nota: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente pelo Supabase.*

### 3. Deploy do Código
Cole o conteúdo de \`artifacts/stripe-webhook-edge/index.ts\` no editor da função ou use o CLI:
\`\`\`bash
supabase functions deploy stripe-webhook --no-verify-jwt
\`\`\`

### 4. Atualização no Stripe
No **Stripe Dashboard** > **Webhooks**, atualize a URL para:
\`https://bsrjtmssbnvttzrvnaab.supabase.co/functions/v1/stripe-webhook\`
