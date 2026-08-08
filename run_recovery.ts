import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function runRecovery() {
  const empresa_55bd_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';
  const empresa_c610_id = 'c610705d-e900-4b6f-8460-1a0633b7962a';
  const bank_55bd_id = 'd8216a75-6cdb-498f-a2e2-183155b3bd07';
  const user_roberto_id = '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3';
  const owner_c610_id = '2e91f665-e744-40bb-90fa-7a5fbee21173';

  console.log('--- Phase 1: Moving Rules (C610 -> 55BD for Roberto) ---');
  // Since we can't easily run a complex transaction block via the JS client, 
  // and psql is restricted, we'll perform atomic steps and validate each.
  
  const { data: movedRules, error: moveError } = await (supabaseAdmin
    .from('payment_routing_rules') as any)
    .update({ 
      empresa_id: empresa_55bd_id, 
      bank_account_id: bank_55bd_id 
    })
    .eq('empresa_id', empresa_c610_id)
    .eq('user_id', user_roberto_id)
    .is('bank_account_id', null)
    .select();

  if (moveError) {
    console.error('Error moving rules:', moveError);
    return;
  }
  console.log(`Moved ${movedRules?.length || 0} rules.`);

  console.log('--- Phase 2: Restoring C610 Defaults ---');
  const { error: restoreError } = await supabaseAdmin
    .rpc('ensure_empresa_defaults', { 
      p_user_id: owner_c610_id, 
      p_empresa_id: empresa_c610_id 
    });

  if (restoreError) {
    console.error('Error restoring C610 defaults:', restoreError);
    // Note: If this fails, we might need a manual cleanup, but at least Roberto's rules are moved.
    return;
  }
  console.log('C610 defaults restored.');

  console.log('--- Phase 3: Validation ---');
  const { count: c610Count } = await supabaseAdmin
    .from('payment_routing_rules')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresa_c610_id)
    .eq('user_id', owner_c610_id);

  const { count: b55dCount } = await supabaseAdmin
    .from('payment_routing_rules')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresa_55bd_id)
    .eq('user_id', user_roberto_id)
    .eq('bank_account_id', bank_55bd_id);

  const { data: crossCheck } = await supabaseAdmin
    .from('payment_routing_rules')
    .select('id, empresa_id, bank_account_id, bank_accounts(empresa_id)')
    .not('bank_account_id', 'is', null);

  const crossCompanyCount = crossCheck?.filter(r => {
      const bank = r.bank_accounts as any;
      return bank && bank.empresa_id !== r.empresa_id;
  }).length || 0;

  console.log(`C610 Owner Rules: ${c610Count}`);
  console.log(`55BD Roberto Rules: ${b55dCount}`);
  console.log(`Cross-company Bank References: ${crossCompanyCount}`);

  if (c610Count === 12 && b55dCount === 12 && crossCompanyCount === 0) {
    console.log('SUCCESS: Recovery and validation complete.');
  } else {
    console.error('FAILURE: Post-recovery validation failed.');
  }
}

runRecovery();
