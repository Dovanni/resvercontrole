DO $$
DECLARE
    v_incident_id text := 'VEJAMAIS_MULTIEMPRESA_POST_ACTIVATION_F958_20260808';
    v_snapshot_at timestamptz := now();
    v_manifest_hash text;
    v_prev_manifest_hash text := '9451e68cced95cc3d22e484cecdb659f810bb1b870ac714c721b67ef7d1fc606';
    v_record_count int := 0;
    
    -- Precondition variables
    v_empresa_id uuid := 'f958365e-3951-46e6-8595-e4f111115a90';
    v_user_id uuid := '1fcb4d6b-61bd-4af9-bf12-87c514094921';
    v_onboarding_id uuid := 'fccca265-444e-4473-b26e-f52debeafd41';
    
    v_row_data jsonb;
    v_row_hash text;
BEGIN
    -- 1. VALIDATION BLOCK
    IF NOT EXISTS (
        SELECT 1 FROM public.empresas 
        WHERE id = v_empresa_id 
        AND nome = 'resvera cosméticos' 
        AND documento = '33613716000113' 
        AND status = 'active'
    ) THEN RAISE EXCEPTION 'Precondition Failed: F958 Data Mismatch'; END IF;

    IF (SELECT count(*) FROM public.user_company_access WHERE user_id = v_user_id AND empresa_id = v_empresa_id AND role = 'admin' AND is_primary = true) != 1 THEN
        RAISE EXCEPTION 'Precondition Failed: Membership mismatch';
    END IF;
    
    IF (SELECT count(*) FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin') != 1 THEN
        RAISE EXCEPTION 'Precondition Failed: Global Role mismatch';
    END IF;

    IF (SELECT count(*) FROM public.bank_accounts WHERE empresa_id = v_empresa_id) != 1 THEN
        RAISE EXCEPTION 'Precondition Failed: F958 Bank count mismatch';
    END IF;
    
    IF (SELECT count(*) FROM public.payment_routing_rules WHERE empresa_id = v_empresa_id) != 12 THEN
        RAISE EXCEPTION 'Precondition Failed: F958 Rules count mismatch';
    END IF;
    
    IF (SELECT count(*) FROM public.categorias_contas_pagar WHERE empresa_id = v_empresa_id) != 7 THEN
        RAISE EXCEPTION 'Precondition Failed: F958 Category count mismatch';
    END IF;

    IF (SELECT count(*) FROM public.payment_routing_rules WHERE empresa_id = 'c610705d-e900-4b6f-8460-1a0633b7962a') != 12 THEN RAISE EXCEPTION 'C610 rules mismatch'; END IF;
    IF (SELECT count(*) FROM public.categorias_contas_pagar WHERE empresa_id = 'c610705d-e900-4b6f-8460-1a0633b7962a') != 7 THEN RAISE EXCEPTION 'C610 categories mismatch'; END IF;
    IF (SELECT count(*) FROM public.payment_routing_rules WHERE empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7') != 12 THEN RAISE EXCEPTION '55BD rules mismatch'; END IF;
    IF (SELECT count(*) FROM public.categorias_contas_pagar WHERE empresa_id = '55bdfa1d-263d-4099-b2f9-35dea74719f7') != 36 THEN RAISE EXCEPTION '55BD category mismatch'; END IF;

    IF (SELECT status FROM public.pending_onboardings WHERE id = v_onboarding_id) != 'activated' THEN
        RAISE EXCEPTION 'Precondition Failed: Onboarding not activated';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM private.manifests WHERE incident_id = 'VEJAMAIS_MULTIEMPRESA_INTEGRITY_20260808' AND manifest_hash = v_prev_manifest_hash) THEN
        RAISE EXCEPTION 'Precondition Failed: Previous manifest mismatch or missing';
    END IF;

    IF EXISTS (SELECT 1 FROM private.manifests WHERE incident_id = v_incident_id) THEN
        RAISE NOTICE 'Snapshot already exists';
        RETURN;
    END IF;

    -- 2. EXECUTION BLOCK
    FOR v_row_data IN (SELECT to_jsonb(t) - 'password' - 'token' - 'secret' FROM public.empresas t WHERE id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7') ORDER BY id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'empresas', (v_row_data->>'id')::uuid, (v_row_data->>'id')::uuid, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) FROM public.user_company_access t WHERE empresa_id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7') ORDER BY user_id, empresa_id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'user_company_access', (v_row_data->>'id')::uuid, (v_row_data->>'empresa_id')::uuid, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) FROM public.user_roles t WHERE user_id IN (SELECT user_id FROM public.user_company_access WHERE empresa_id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')) ORDER BY user_id, role)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'user_roles', (v_row_data->>'id')::uuid, NULL, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) - 'email' - 'raw_user_meta_data' - 'raw_app_meta_data' FROM public.profiles t WHERE id IN (SELECT user_id FROM public.user_company_access WHERE empresa_id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7')) ORDER BY id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'profiles', (v_row_data->>'id')::uuid, NULL, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) FROM public.bank_accounts t WHERE empresa_id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7') ORDER BY id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'bank_accounts', (v_row_data->>'id')::uuid, (v_row_data->>'empresa_id')::uuid, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) FROM public.payment_routing_rules t WHERE empresa_id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7') ORDER BY id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'payment_routing_rules', (v_row_data->>'id')::uuid, (v_row_data->>'empresa_id')::uuid, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) FROM public.categorias_contas_pagar t WHERE empresa_id IN (v_empresa_id, 'c610705d-e900-4b6f-8460-1a0633b7962a', '55bdfa1d-263d-4099-b2f9-35dea74719f7') ORDER BY id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'categorias_contas_pagar', (v_row_data->>'id')::uuid, (v_row_data->>'empresa_id')::uuid, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    FOR v_row_data IN (SELECT to_jsonb(t) FROM public.pending_onboardings t WHERE id = v_onboarding_id ORDER BY id)
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'pending_onboardings', (v_row_data->>'id')::uuid, NULL, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    -- Functions
    FOR v_row_data IN (
        SELECT jsonb_build_object('name', proname, 'definition', pg_get_functiondef(p.oid), 'acl', proacl)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname IN ('reconcile_and_finalize_onboarding', 'ensure_empresa_defaults')
    )
    LOOP
        v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
        INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
        VALUES (v_incident_id, v_snapshot_at, 'pg_proc', gen_random_uuid(), NULL, v_row_data, v_row_hash);
        v_record_count := v_record_count + 1;
    END LOOP;

    -- Constraints
    v_row_data := (
        SELECT jsonb_agg(jsonb_build_object('name', conname, 'def', pg_get_constraintdef(oid)))
        FROM pg_constraint 
        WHERE conrelid IN ('public.bank_accounts'::regclass, 'public.payment_routing_rules'::regclass, 'public.categorias_contas_pagar'::regclass) 
        AND contype = 'u'
    );
    v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    VALUES (v_incident_id, v_snapshot_at, 'pg_constraint', gen_random_uuid(), NULL, v_row_data, v_row_hash);
    v_record_count := v_record_count + 1;

    -- Indexes
    v_row_data := (
        SELECT jsonb_agg(jsonb_build_object('name', i.relname, 'def', pg_get_indexdef(i.oid)))
        FROM pg_index x
        JOIN pg_class c ON c.oid = x.indrelid
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname IN ('bank_accounts', 'payment_routing_rules', 'categorias_contas_pagar') AND n.nspname = 'public'
    );
    v_row_hash := encode(digest(v_row_data::text, 'sha256'), 'hex');
    INSERT INTO private.snapshots (incident_id, snapshot_at, source_table, source_primary_key, empresa_id, row_data, row_hash)
    VALUES (v_incident_id, v_snapshot_at, 'pg_index', gen_random_uuid(), NULL, v_row_data, v_row_hash);
    v_record_count := v_record_count + 1;

    -- 3. MANIFEST
    SELECT encode(digest(string_agg(row_hash, '' ORDER BY row_hash), 'sha256'), 'hex') INTO v_manifest_hash
    FROM private.snapshots WHERE incident_id = v_incident_id;

    INSERT INTO private.manifests (incident_id, snapshot_at, manifest_hash, record_count)
    VALUES (v_incident_id, v_snapshot_at, v_manifest_hash, v_record_count);
END $$;