
import { supabaseAdmin } from './src/integrations/supabase/client.server';

async function audit() {
  const incident_id = 'VEJAMAIS_MULTIEMPRESA_INTEGRITY_20260808';
  
  const { data: manifests, error: me } = await supabaseAdmin.from('manifests' as any).select('*').eq('incident_id', incident_id);
  if (me) {
      // Try with schema prefix if the client isn't configured for 'private'
      const { data: manifests2, error: me2 } = await supabaseAdmin.rpc('get_manifests' as any, { p_incident_id: incident_id });
      console.log('Manifest Error:', me);
  } else {
      console.log('Manifests:', manifests);
  }

  // Since I can't easily change the schema of the supabase client for a single query, 
  // I'll use raw SQL via a function if needed, or just run another migration to GRANT SELECT to service_role.
}

// Actually, I'll just run a quick migration to grant select to service_role on the private schema.
// That's cleaner than trying to bypass it.
