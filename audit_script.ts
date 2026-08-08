
import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function runAudit() {
  const audit: any = {};

  try {
    const empresa_55bd_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    const empresa_c610_id = 'c610705d-e900-4b6f-8460-1a0633b7962a';
    const user_roberto_id = '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3';
    const owner_c610_id = '2e91f665-e744-40bb-90fa-7a5fbee21173';
    const empresa_f958_id = 'f958365e-3951-46e6-8595-e4f111115a90';
    const target_user_id = '1fcb4d6b-0701-447a-9a00-53909191d4e0';

    const { data: rules55BD } = await supabaseAdmin.from('payment_routing_rules').select('*').eq('empresa_id', empresa_55bd_id);
    const { data: rulesC610 } = await supabaseAdmin.from('payment_routing_rules').select('*').eq('empresa_id', empresa_c610_id);

    audit.company_55bd_routing_count = rules55BD?.length || 0;
    audit.company_55bd_distinct_payment_method_count = new Set(rules55BD?.map(r => r.payment_method)).size;
    audit.company_55bd_wrong_user_count = rules55BD?.filter(r => r.user_id !== user_roberto_id).length || 0;
    
    const bankIds55BD = [...new Set(rules55BD?.map(r => r.bank_account_id).filter(Boolean))];
    const { data: banks55BD } = await supabaseAdmin.from('bank_accounts').select('id, empresa_id').in('id', bankIds55BD);
    const bankMap55BD = Object.fromEntries(banks55BD?.map(b => [b.id, b.empresa_id]) || []);
    audit.company_55bd_wrong_bank_count = rules55BD?.filter(r => r.bank_account_id && bankMap55BD[r.bank_account_id] !== empresa_55bd_id).length || 0;
    audit.company_55bd_duplicate_count = (rules55BD?.length || 0) - audit.company_55bd_distinct_payment_method_count;

    audit.c610_routing_count = rulesC610?.length || 0;
    audit.c610_distinct_payment_method_count = new Set(rulesC610?.map(r => r.payment_method)).size;
    audit.c610_roberto_rule_count = rulesC610?.filter(r => r.user_id === user_roberto_id).length || 0;
    audit.c610_wrong_user_count = rulesC610?.filter(r => r.user_id !== owner_c610_id).length || 0;
    
    const bankIdsC610 = [...new Set(rulesC610?.map(r => r.bank_account_id).filter(Boolean))];
    const { data: banksC610 } = await supabaseAdmin.from('bank_accounts').select('id, empresa_id').in('id', bankIdsC610);
    const bankMapC610 = Object.fromEntries(banksC610?.map(b => [b.id, b.empresa_id]) || []);
    audit.c610_wrong_bank_count = rulesC610?.filter(r => r.bank_account_id && bankMapC610[r.bank_account_id] !== empresa_c610_id).length || 0;
    audit.c610_duplicate_count = (rulesC610?.length || 0) - audit.c610_distinct_payment_method_count;

    // 4. Global Integrity
    const { data: allRules } = await supabaseAdmin.from('payment_routing_rules').select('id, empresa_id, user_id, bank_account_id, payment_method');
    const { data: allBanks } = await supabaseAdmin.from('bank_accounts').select('id, empresa_id');
    const bankMap = Object.fromEntries(allBanks?.map(b => [b.id, b.empresa_id]) || []);

    audit.global_cross_company_bank_reference_count = allRules?.filter(r => r.bank_account_id && bankMap[r.bank_account_id] !== r.empresa_id).length || 0;
    audit.global_null_empresa_rule_count = allRules?.filter(r => !r.empresa_id).length || 0;
    audit.global_null_bank_rule_count = allRules?.filter(r => !r.bank_account_id).length || 0;

    const { data: allMemberships } = await supabaseAdmin.from('user_company_access').select('user_id, empresa_id');
    const membershipSet = new Set(allMemberships?.map(m => `${m.user_id}:${m.empresa_id}`) || []);
    audit.global_membership_mismatch_rule_count = allRules?.filter(r => !membershipSet.has(`${r.user_id}:${r.empresa_id}`)).length || 0;

    const { data: allCategories } = await supabaseAdmin.from('categorias_contas_pagar').select('*');
    if (allCategories) {
      audit.global_membership_mismatch_category_count = allCategories.filter(c => !membershipSet.has(`${c.user_id}:${c.empresa_id}`)).length;
      audit.global_null_empresa_category_count = allCategories.filter(c => !c.empresa_id).length;
      
      const catKeySet = new Set();
      let duplicates = 0;
      for (const cat of allCategories) {
          const key = `${cat.empresa_id}:${cat.nome}`;
          if (catKeySet.has(key)) duplicates++;
          catKeySet.add(key);
      }
      audit.global_category_duplicate_count = duplicates;
    }

    // Uniqueness by (empresa_id, payment_method)
    const ruleKeySet = new Set();
    let ruleDuplicates = 0;
    for (const rule of allRules || []) {
        const key = `${rule.empresa_id}:${rule.payment_method}`;
        if (ruleKeySet.has(key)) ruleDuplicates++;
        ruleKeySet.add(key);
    }
    audit.global_routing_duplicate_count = ruleDuplicates;

    // 5. Company F958
    const { data: f958Data } = await supabaseAdmin.from('empresas').select('*').eq('id', empresa_f958_id).single();
    audit.f958_company_exists = !!f958Data;
    audit.f958_company_name = f958Data?.nome;
    audit.f958_document = f958Data?.documento;

    const { data: f958Membership } = await supabaseAdmin.from('user_company_access').select('*').eq('empresa_id', empresa_f958_id).eq('user_id', target_user_id).single();
    audit.f958_membership_role = f958Membership?.role;
    audit.f958_membership_status = f958Membership?.status;

    const { data: targetRoles } = await supabaseAdmin.from('user_roles').select('*').eq('user_id', target_user_id);
    audit.f958_global_role = targetRoles?.[0]?.role;

    const { count: f958Banks } = await supabaseAdmin.from('bank_accounts').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_f958_id);
    const { count: f958Rules } = await supabaseAdmin.from('payment_routing_rules').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_f958_id);
    const { count: f958Cats } = await supabaseAdmin.from('categorias_contas_pagar').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa_f958_id);

    audit.f958_bank_account_count = f958Banks || 0;
    audit.f958_routing_count = f958Rules || 0;
    audit.f958_category_count = f958Cats || 0;

    const { data: onboarding } = await supabaseAdmin.from('pending_onboardings').select('*').eq('user_id', target_user_id).single();
    audit.pending_status = onboarding?.status;

    // 6. Preservations check
    const tablesToCheck = ['sales', 'sale_items', 'compras', 'compras_itens', 'payables', 'receivables', 'bank_movements', 'cartoes_credito'];
    for (const table of tablesToCheck) {
        const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
        audit[`${table}_count`] = count || 0;
    }

    console.log(JSON.stringify(audit, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runAudit();
