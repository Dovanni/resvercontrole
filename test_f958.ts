
import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function test() {
  const id = 'f958365e-3951-46e6-8595-e4f111115a90';
  const { data, error } = await supabaseAdmin.from('empresas').select('*').eq('id', id);
  console.log('F958 Data:', data);
  console.log('F958 Error:', error);

  const { data: m, error: me } = await supabaseAdmin.from('user_company_access').select('*').eq('empresa_id', id);
  console.log('F958 Memberships:', m);
  console.log('F958 Memberships Error:', me);
}

test();
