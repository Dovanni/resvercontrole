import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function finish() {
  const empresa_c610_id = 'c610705d-e900-4b6f-8460-1a0633b7962a';
  const owner_c610_id = '2e91f665-e744-40bb-90fa-7a5fbee21173';
  const bank_c610_id = '8c52d65a-f82e-4dd2-a397-f50bb395ec07';
  const methods = ['pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'transfer', 'other', 'voucher', 'crypto', 'bank_check', 'digital_wallet', 'direct_debit'];

  console.log('--- Restoring C610 Rules via Admin Client ---');
  for (const method of methods) {
    const { error } = await supabaseAdmin
      .from('payment_routing_rules')
      .upsert({
        empresa_id: empresa_c610_id,
        user_id: owner_c610_id,
        bank_account_id: bank_c610_id,
        payment_method: method
      }, { onConflict: 'empresa_id,payment_method' });
    
    if (error) console.error(`Error for ${method}:`, error);
  }

  const { count: c610Count } = await supabaseAdmin
    .from('payment_routing_rules')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresa_c610_id)
    .eq('user_id', owner_c610_id);

  console.log(`Final C610 count: ${c610Count}`);
}

finish();
