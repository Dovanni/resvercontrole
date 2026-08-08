
BEGIN;

-- 1. Schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- 2. Tables
CREATE TABLE IF NOT EXISTS private.snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id text NOT NULL,
    snapshot_at timestamptz NOT NULL DEFAULT now(),
    source_table text NOT NULL,
    source_primary_key uuid NOT NULL,
    empresa_id uuid,
    row_data jsonb NOT NULL,
    row_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS private.manifests (
    incident_id text PRIMARY KEY,
    snapshot_at timestamptz NOT NULL DEFAULT now(),
    manifest_hash text NOT NULL,
    record_count integer NOT NULL
);

-- Revoke access to tables
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM public;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM authenticated;

-- 3. Snapshot Data Capture
-- Incident ID: VEJAMAIS_MULTIEMPRESA_INTEGRITY_20260808

DO $$
DECLARE
    v_incident_id text := 'VEJAMAIS_MULTIEMPRESA_INTEGRITY_20260808';
    v_snapshot_at timestamptz := now();
    v_manifest_hash text;
    v_record_count integer := 0;
    
    -- Validation counts
    v_rules_c610_count integer;
    v_rules_55bd_count integer;
    v_rules_f958_count integer;
    
    v_cats_c610_count integer;
    v_cats_55bd_count integer;
    v_cats_f958_count integer;
    
    v_banks_c610_count integer;
    v_banks_55bd_count integer;
    v_banks_f958_count integer;
    
    v_pending_status text;
    v_f958_name text;
    v_global_role text;
    v_f958_membership_role text;
    v_f958_membership_status text;
BEGIN
    -- PRE-VALIDATION
    SELECT count(*) INTO v_rules_c610_count FROM public.payment_routing_rules WHERE empresa_id = 'c610705d-e900-4b6f-8460-1a0633b7962a';
    SELECT count(*) INTO v_rules_55bd_count FROM public.payment_routing_rules WHERE empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    SELECT count(*) INTO v_rules_f958_count FROM public.payment_routing_rules WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90';
    
    SELECT count(*) INTO v_cats_c610_count FROM public.categorias_contas_pagar WHERE empresa_id = 'c610705d-e900-4b6f-8460-1a0633b7962a';
    SELECT count(*) INTO v_cats_55bd_count FROM public.categorias_contas_pagar WHERE empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    SELECT count(*) INTO v_cats_f958_count FROM public.categorias_contas_pagar WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90';
    
    SELECT count(*) INTO v_banks_c610_count FROM public.bank_accounts WHERE empresa_id = 'c610705d-e900-4b6f-8460-1a0633b7962a';
    SELECT count(*) INTO v_banks_55bd_count FROM public.bank_accounts WHERE empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7';
    SELECT count(*) INTO v_banks_f958_count FROM public.bank_accounts WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90';
    
    SELECT status INTO v_pending_status FROM public.pending_onboardings WHERE id = 'fccca265-444e-4473-b26e-f52debeafd41';
    SELECT nome INTO v_f958_name FROM public.empresas WHERE id = 'f958365e-3951-46e6-8595-e4f111115a90';
    SELECT role INTO v_global_role FROM public.user_roles WHERE user_id = '1fcb4d6b-61bd-4af9-bf12-87c514094921';
    SELECT role, status INTO v_f958_membership_role, v_f958_membership_status 
    FROM public.user_company_access 
    WHERE empresa_id = 'f958365e-3951-46e6-8595-e4f111115a90' AND user_id = '1fcb4d6b-61bd-4af9-bf12-87c514094921';

    IF v_rules_c610_count != 12 OR v_rules_55bd_count != 12 OR v_rules_f958_count != 0 OR
       v_cats_c610_count != 7 OR v_cats_55bd_count != 36 OR v_cats_f958_count != 0 OR
       v_banks_c610_count != 1 OR v_banks_55bd_count != 6 OR v_banks_f958_count != 0 OR
       v_pending_status != 'pending' OR v_f958_name != 'Minha Empresa' OR v_global_role != 'vendedor' OR
       v_f958_membership_role != 'admin' OR v_f958_membership_status != 'active'
    THEN
        RAISE EXCEPTION 'Snapshot pre-validation failed. Counts mismatch.';
    END IF;

    -- CAPTURE EMPRESAS
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'empresas', id, id, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.empresas t
    WHERE id IN ('f958365e-3951-46e6-8595-e4f111115a90', 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')
    ORDER BY id;

    -- CAPTURE user_company_access
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'user_company_access', id, empresa_id, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.user_company_access t
    WHERE empresa_id IN ('f958365e-3951-46e6-8595-e4f111115a90', 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')
    ORDER BY id;

    -- CAPTURE user_roles
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'user_roles', id, NULL, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.user_roles t
    WHERE user_id IN ('1fcb4d6b-61bd-4af9-bf12-87c514094921', '2e91f665-e744-40bb-90fa-7a5fbee21173', '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3')
    ORDER BY id;

    -- CAPTURE profiles (essential fields only)
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'profiles', id, NULL, 
           jsonb_build_object('id', id, 'full_name', full_name, 'business_name', business_name), 
           encode(digest(jsonb_build_object('id', id, 'full_name', full_name, 'business_name', business_name)::text, 'sha256'), 'hex')
    FROM public.profiles t
    WHERE id IN ('1fcb4d6b-61bd-4af9-bf12-87c514094921', '2e91f665-e744-40bb-90fa-7a5fbee21173', '4feca174-6bd8-4e9d-b3bb-5e59ced89ee3')
    ORDER BY id;

    -- CAPTURE bank_accounts
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'bank_accounts', id, empresa_id, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.bank_accounts t
    WHERE empresa_id IN ('f958365e-3951-46e6-8595-e4f111115a90', 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')
    ORDER BY id;

    -- CAPTURE payment_routing_rules
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'payment_routing_rules', id, empresa_id, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.payment_routing_rules t
    WHERE empresa_id IN ('f958365e-3951-46e6-8595-e4f111115a90', 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')
    ORDER BY id;

    -- CAPTURE categorias_contas_pagar
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'categorias_contas_pagar', id, empresa_id, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.categorias_contas_pagar t
    WHERE empresa_id IN ('f958365e-3951-46e6-8595-e4f111115a90', 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')
    ORDER BY id;

    -- CAPTURE pending_onboardings (specific record)
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    SELECT v_incident_id, v_snapshot_at, 'pending_onboardings', id, NULL, to_jsonb(t), encode(digest(to_jsonb(t)::text, 'sha256'), 'hex')
    FROM public.pending_onboardings t
    WHERE id = 'fccca265-444e-4473-b26e-f52debeafd41';

    -- MANIFEST
    SELECT count(*) INTO v_record_count FROM private.snapshots WHERE incident_id = v_incident_id;
    
    -- Calculate manifest hash based on all row hashes in order
    SELECT encode(digest(string_agg(row_hash, '' ORDER BY source_table, source_primary_key), 'sha256'), 'hex')
    INTO v_manifest_hash
    FROM private.snapshots
    WHERE incident_id = v_incident_id;

    INSERT INTO private.manifests (incident_id, snapshot_at, manifest_hash, record_count)
    VALUES (v_incident_id, v_snapshot_at, v_manifest_hash, v_record_count);

    RAISE NOTICE 'Snapshot created successfully with % records.', v_record_count;
END $$;

COMMIT;
