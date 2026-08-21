import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const baselineRoot = process.env.BASELINE_ROOT || path.join(repoRoot, 'supabase', 'baseline-candidate');
const schema = fs.readFileSync(path.join(baselineRoot, '00000000000000_vejamais_canonical_schema_candidate.sql'), 'utf8');
const functions = fs.readFileSync(path.join(baselineRoot, '00000000000001_vejamais_canonical_functions_candidate.sql'), 'utf8');
const security = fs.readFileSync(path.join(baselineRoot, '00000000000002_vejamais_canonical_security_candidate.sql'), 'utf8');
const generatedTypes = fs.readFileSync(path.join(repoRoot, 'src', 'integrations', 'supabase', 'types.ts'), 'utf8');
const executableFunctions = functions.replace(/^\s*--.*$/gm, '');

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx)$/.test(entry.name) && !file.includes(`${path.sep}__tests__${path.sep}`)) sourceFiles.push(file);
  }
}
walk(path.join(repoRoot, 'src'));

const failures = [];
const check = (condition, code, detail = '') => {
  if (!condition) failures.push({ code, detail });
};

const tableNames = [...schema.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? public\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]);
const uniqueTables = [...new Set(tableNames)].sort();
const typeTableNames = [...generatedTypes.matchAll(/^      ([a-z_][a-z0-9_]*): \{\n        Row: \{/gm)].map((m) => m[1]).sort();

const runtimeText = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const runtimeTables = [...new Set([...runtimeText.matchAll(/\.from\(["']([a-z_][a-z0-9_]*)["']\)/g)].map((m) => m[1]))].sort();
const runtimeRpcs = [...new Set([...runtimeText.matchAll(/\.rpc\(["']([a-z_][a-z0-9_]*)["']/g)].map((m) => m[1]))].sort();
const functionNames = [...new Set([...functions.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_][a-z0-9_]*)\s*\(/g)].map((m) => m[1]))].sort();
const triggerFunctions = [...new Set([...functions.matchAll(/EXECUTE FUNCTION public\.([a-z_][a-z0-9_]*)\s*\(/g)].map((m) => m[1]))].sort();
const rlsTables = [...new Set([...security.matchAll(/ALTER TABLE public\.([a-z_][a-z0-9_]*) ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]))].sort();
const policyCount = [...security.matchAll(/CREATE POLICY /g)].length;
const triggerCount = [...functions.matchAll(/CREATE TRIGGER /g)].length;
const securityDefinerBlocks = functions.split(/(?=CREATE OR REPLACE FUNCTION )/).filter((block) => /SECURITY DEFINER/i.test(block));

check(uniqueTables.length === 38, 'TABLE_COUNT', `found=${uniqueTables.length}`);
check(JSON.stringify(uniqueTables) === JSON.stringify(typeTableNames), 'TYPE_TABLE_SET_MISMATCH');
check(runtimeTables.every((name) => uniqueTables.includes(name)), 'RUNTIME_TABLE_MISSING', runtimeTables.filter((name) => !uniqueTables.includes(name)).join(','));
check(runtimeRpcs.every((name) => functionNames.includes(name)), 'RUNTIME_RPC_MISSING', runtimeRpcs.filter((name) => !functionNames.includes(name)).join(','));
check(triggerFunctions.every((name) => functionNames.includes(name)), 'TRIGGER_FUNCTION_MISSING', triggerFunctions.filter((name) => !functionNames.includes(name)).join(','));
check(rlsTables.length === 38, 'RLS_TABLE_COUNT', `found=${rlsTables.length}`);
check(policyCount === 45, 'POLICY_COUNT', `found=${policyCount}`);
check(triggerCount === 39, 'TRIGGER_COUNT', `found=${triggerCount}`);
check(securityDefinerBlocks.every((block) => /SET search_path = (?:pg_catalog, public, pg_temp|public)/i.test(block)), 'SECURITY_DEFINER_SEARCH_PATH');
check(!/GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated/i.test(security), 'AUTHENTICATED_GLOBAL_EXECUTE');
check(!/GRANT EXECUTE ON FUNCTION public\.ensure_empresa_defaults\(uuid, uuid\) TO authenticated/i.test(security), 'EXCESSIVE_ENSURE_DEFAULTS_GRANT');
check(/GRANT EXECUTE ON FUNCTION public\.reconcile_and_finalize_onboarding\(\) TO authenticated/i.test(security), 'RECONCILE_GRANT_MISSING');
check(/CREATE OR REPLACE FUNCTION public\.reconcile_and_finalize_onboarding\(\)/i.test(functions), 'RECONCILE_FUNCTION_MISSING');
check(!/CREATE OR REPLACE FUNCTION public\.rpc_registrar_compra_test\s*\(/i.test(executableFunctions), 'TEST_RPC_PRESENT');
check(!/rpc_registrar_compra_test\s*:/.test(generatedTypes), 'TEST_RPC_PRESENT_IN_TYPES');
check(!/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(executableFunctions), 'HARDCODED_UUID_IN_FUNCTIONS');
check(!/_user_id\s*:\s*context\.userId/.test(runtimeText), 'LEGACY_ACCEPT_INVITATION_ARGUMENT');
check(!/error_payload\??:\s*Json/.test(generatedTypes), 'DROPPED_DIAGNOSTIC_COLUMN_IN_TYPES');

const result = {
  protocol: 'VEJAMAIS-CLOUDFLARE-MIGRATION-PHASE-2B-CONTRACT-CERTIFICATION-v1',
  mode: 'REPOSITORY_ONLY',
  checks_failed: failures.length,
  failures,
  metrics: {
    source_files_scanned: sourceFiles.length,
    public_tables: uniqueTables.length,
    generated_type_tables: typeTableNames.length,
    runtime_tables: runtimeTables.length,
    functions: functionNames.length,
    runtime_rpcs: runtimeRpcs.length,
    triggers: triggerCount,
    policies: policyCount,
    rls_tables: rlsTables.length,
    security_definer_functions: securityDefinerBlocks.length,
  },
  prohibited_actions: {
    database_connections: 0,
    sql_executions: 0,
    supabase_actions: 0,
    cloudflare_actions: 0,
    dns_actions: 0,
    production_actions: 0,
  },
  decision: failures.length === 0
    ? 'PHASE_2B_REPOSITORY_CONTRACTS_CERTIFIED_READY_FOR_HUMAN_REVIEW'
    : 'PHASE_2B_REPOSITORY_CONTRACTS_NONCONFORMING',
};

console.log(JSON.stringify(result, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
