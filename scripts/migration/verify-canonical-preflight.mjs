import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.env.REPO_ROOT || process.cwd();
const baselineRoot = process.env.BASELINE_ROOT || path.join(repoRoot, 'supabase', 'baseline-candidate');
const files = {
  schema: '00000000000000_vejamais_canonical_schema_candidate.sql',
  functions: '00000000000001_vejamais_canonical_functions_candidate.sql',
  security: '00000000000002_vejamais_canonical_security_candidate.sql',
};
const text = Object.fromEntries(Object.entries(files).map(([key, name]) => [key, fs.readFileSync(path.join(baselineRoot, name), 'utf8')]));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const applicationPlan = JSON.parse(fs.readFileSync(path.join(baselineRoot, 'APPLICATION_PLAN.json'), 'utf8'));
const failures = [];
const checks = [];
function check(condition, code, detail = '') {
  checks.push({ code, pass: Boolean(condition), detail });
  if (!condition) failures.push({ code, detail });
}

function lexicalScan(sql) {
  let state = 'normal', dollar = '', parens = 0, semicolons = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1];
    if (state === 'line') { if (c === '\n') state = 'normal'; continue; }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'normal'; i++; } continue; }
    if (state === 'single') { if (c === "'" && n === "'") { i++; continue; } if (c === "'") state = 'normal'; continue; }
    if (state === 'double') { if (c === '"' && n === '"') { i++; continue; } if (c === '"') state = 'normal'; continue; }
    if (state === 'dollar') { if (sql.startsWith(dollar, i)) { i += dollar.length - 1; state = 'normal'; } continue; }
    if (c === '-' && n === '-') { state = 'line'; i++; continue; }
    if (c === '/' && n === '*') { state = 'block'; i++; continue; }
    if (c === "'") { state = 'single'; continue; }
    if (c === '"') { state = 'double'; continue; }
    if (c === '$') { const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/); if (m) { dollar = m[0]; state = 'dollar'; i += dollar.length - 1; continue; } }
    if (c === '(') parens++;
    if (c === ')') parens--;
    if (c === ';' && parens === 0) semicolons++;
    if (parens < 0) return { valid: false, state, parens, semicolons, error: `unexpected ')' at byte ${i}` };
  }
  const valid = (state === 'normal' || state === 'line') && parens === 0;
  return { valid, state, parens, semicolons, error: valid ? '' : `unterminated ${state}; parens=${parens}` };
}

function maskDollarBodies(sql) {
  return sql.replace(/(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)[\s\S]*?\1/g, '$1__BODY__$1');
}

for (const [key, sql] of Object.entries(text)) {
  const scan = lexicalScan(sql);
  check(scan.valid, `SQL_LEXICAL_${key.toUpperCase()}`, scan.error || `top_level_semicolons=${scan.semicolons}`);
  const top = maskDollarBodies(sql).replace(/^\s*--.*$/gm, '');
  const prohibited = [...top.matchAll(/^\s*(INSERT|UPDATE|DELETE|COPY|TRUNCATE|MERGE|DO)\b/gim)].map((m) => m[1].toUpperCase());
  check(prohibited.length === 0, `TOP_LEVEL_DML_${key.toUpperCase()}`, prohibited.join(','));
}

const tableMatches = [...text.schema.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? public\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)^\);/gm)];
const tableOrder = tableMatches.map((m) => m[1]);
const tableSet = new Set(tableOrder);
check(tableOrder.length === 38 && tableSet.size === 38, 'TABLE_SET', `count=${tableOrder.length}; unique=${tableSet.size}`);

const tableColumns = new Map(tableMatches.map((match) => [
  match[1],
  new Set(match[2].split('\n').map((line) => line.match(/^\s{2,4}([a-z_][a-z0-9_]*)\s+/i)?.[1]).filter(Boolean)),
]));
for (const add of text.schema.matchAll(/ALTER TABLE public\.([a-z_][a-z0-9_]*)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
  tableColumns.get(add[1])?.add(add[2]);
}

const forwardReferences = [];
for (let i = 0; i < tableMatches.length; i++) {
  for (const reference of tableMatches[i][2].matchAll(/REFERENCES\s+public\.([a-z_][a-z0-9_]*)\s*\(\s*([a-z_][a-z0-9_]*)\s*\)/gi)) {
    const targetIndex = tableOrder.indexOf(reference[1]);
    if (targetIndex > i) forwardReferences.push(`${tableMatches[i][1]}->${reference[1]}`);
    check(targetIndex >= 0, 'FK_TARGET_TABLE_EXISTS', `${tableMatches[i][1]}->${reference[1]}`);
    check(tableColumns.get(reference[1])?.has(reference[2]), 'FK_TARGET_COLUMN_EXISTS', `${tableMatches[i][1]}->${reference[1]}.${reference[2]}`);
  }
}
check(forwardReferences.length === 0, 'TABLE_TOPOLOGICAL_ORDER', forwardReferences.join(','));

const schemaTargets = [
  ...text.schema.matchAll(/ALTER TABLE public\.([a-z_][a-z0-9_]*)/g),
  ...text.schema.matchAll(/CREATE(?: UNIQUE)? INDEX [^\s]+ ON public\.([a-z_][a-z0-9_]*)/g),
].map((m) => m[1]);
check(schemaTargets.every((name) => tableSet.has(name)), 'SCHEMA_TARGETS_EXIST', schemaTargets.filter((name) => !tableSet.has(name)).join(','));

const functionMatches = [...text.functions.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_][a-z0-9_]*)\s*\(/g)];
const functionSet = new Set(functionMatches.map((m) => m[1]));
const triggerMatches = [...text.functions.matchAll(/CREATE TRIGGER\s+([a-z_][a-z0-9_]*)[\s\S]*?ON public\.([a-z_][a-z0-9_]*)[\s\S]*?EXECUTE FUNCTION public\.([a-z_][a-z0-9_]*)\s*\(/gi)];
check(functionMatches.length === 55 && functionSet.size === 55, 'FUNCTION_SET', `count=${functionMatches.length}; unique_names=${functionSet.size}`);
check(triggerMatches.length === 39, 'TRIGGER_COUNT', `count=${triggerMatches.length}`);
check(triggerMatches.every((m) => tableSet.has(m[2])), 'TRIGGER_TABLES_EXIST', triggerMatches.filter((m) => !tableSet.has(m[2])).map((m) => m[2]).join(','));
check(triggerMatches.every((m) => functionSet.has(m[3])), 'TRIGGER_FUNCTIONS_EXIST', triggerMatches.filter((m) => !functionSet.has(m[3])).map((m) => m[3]).join(','));
const triggerKeys = triggerMatches.map((m) => `${m[2]}.${m[1]}`);
check(new Set(triggerKeys).size === triggerKeys.length, 'TRIGGER_NAMES_UNIQUE_PER_TABLE');

const relationReferences = [...new Set([...`${text.functions}\n${text.security}`.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+public\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]))];
check(relationReferences.every((name) => tableSet.has(name)), 'FUNCTION_RELATION_DEPENDENCIES_EXIST', relationReferences.filter((name) => !tableSet.has(name)).join(','));

const rlsTargets = [...text.security.matchAll(/ALTER TABLE public\.([a-z_][a-z0-9_]*) ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]);
const policies = [...text.security.matchAll(/CREATE POLICY\s+"([^"]+)"\s+ON public\.([a-z_][a-z0-9_]*)/g)];
check(rlsTargets.length === 38 && new Set(rlsTargets).size === 38, 'RLS_TABLE_SET', `count=${rlsTargets.length}`);
check(rlsTargets.every((name) => tableSet.has(name)), 'RLS_TARGETS_EXIST', rlsTargets.filter((name) => !tableSet.has(name)).join(','));
check(policies.length === 45, 'POLICY_COUNT', `count=${policies.length}`);
check(policies.every((m) => tableSet.has(m[2])), 'POLICY_TARGETS_EXIST', policies.filter((m) => !tableSet.has(m[2])).map((m) => m[2]).join(','));
const policyKeys = policies.map((m) => `${m[2]}.${m[1]}`);
check(new Set(policyKeys).size === policyKeys.length, 'POLICY_NAMES_UNIQUE_PER_TABLE');

const grantFunctions = [...text.security.matchAll(/GRANT EXECUTE ON FUNCTION public\.([a-z_][a-z0-9_]*)\s*\(/g)].map((m) => m[1]);
check(grantFunctions.every((name) => functionSet.has(name)), 'GRANT_FUNCTIONS_EXIST', grantFunctions.filter((name) => !functionSet.has(name)).join(','));
check(!/GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated/i.test(text.security), 'NO_GLOBAL_AUTHENTICATED_EXECUTE');
check(!/GRANT EXECUTE ON FUNCTION public\.ensure_empresa_defaults\(uuid, uuid\) TO authenticated/i.test(text.security), 'NO_INTERNAL_ENSURE_DEFAULTS_GRANT');

const securityDefinerBlocks = text.functions.split(/(?=CREATE OR REPLACE FUNCTION )/).filter((block) => /SECURITY DEFINER/i.test(block));
check(securityDefinerBlocks.length === 54, 'SECURITY_DEFINER_COUNT', `count=${securityDefinerBlocks.length}`);
check(securityDefinerBlocks.every((block) => /SET search_path = (?:pg_catalog, public, pg_temp|public)/i.test(block)), 'SECURITY_DEFINER_SEARCH_PATH');
const executableFunctions = text.functions.replace(/^\s*--.*$/gm, '');
check(!/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(executableFunctions), 'NO_HARDCODED_UUID');
check(!/CREATE OR REPLACE FUNCTION public\.rpc_registrar_compra_test\s*\(/i.test(executableFunctions), 'NO_TEST_RPC');

const indexNames = [...text.schema.matchAll(/CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]);
check(new Set(indexNames).size === indexNames.length, 'INDEX_NAMES_UNIQUE', `count=${indexNames.length}`);
const constraintMatches = [...text.schema.matchAll(/ALTER TABLE public\.([a-z_][a-z0-9_]*)\s+ADD CONSTRAINT\s+([a-z_][a-z0-9_]*)/gi)];
const constraintKeys = constraintMatches.map((m) => `${m[1]}.${m[2]}`);
check(new Set(constraintKeys).size === constraintKeys.length, 'CONSTRAINT_NAMES_UNIQUE_PER_TABLE', `count=${constraintKeys.length}`);

const order = Object.values(files);
check(JSON.stringify(order) === JSON.stringify([
  '00000000000000_vejamais_canonical_schema_candidate.sql',
  '00000000000001_vejamais_canonical_functions_candidate.sql',
  '00000000000002_vejamais_canonical_security_candidate.sql',
]), 'APPLICATION_ORDER_EXACT');
check(JSON.stringify(applicationPlan.application_order.map((item) => item.file)) === JSON.stringify(order), 'PLAN_APPLICATION_ORDER_MATCH');
for (const [key, name] of Object.entries(files)) {
  const planned = applicationPlan.application_order.find((item) => item.file === name);
  check(planned?.sha256 === sha256(text[key]), 'PLAN_ARTIFACT_HASH_MATCH', name);
}
check(applicationPlan.target_class === 'NEW_EMPTY_SUPABASE_STAGING_ONLY', 'PLAN_TARGET_IS_EMPTY_STAGING_ONLY');
check(applicationPlan.rollback?.strategy === 'DISCARD_AND_RECREATE_EMPTY_STAGING_PROJECT' && applicationPlan.rollback?.in_place_rollback_allowed === false, 'PLAN_ROLLBACK_IS_DISCARD_ONLY');

const result = {
  protocol: 'VEJAMAIS-CLOUDFLARE-MIGRATION-PHASE-2C-FINAL-STATIC-PREFLIGHT-v1',
  mode: 'REPOSITORY_ONLY_NO_DATABASE_EXECUTION',
  checks_total: checks.length,
  checks_passed: checks.filter((item) => item.pass).length,
  checks_failed: failures.length,
  failures,
  metrics: {
    tables: tableOrder.length,
    forward_table_references: forwardReferences.length,
    functions: functionMatches.length,
    triggers: triggerMatches.length,
    rls_tables: rlsTargets.length,
    policies: policies.length,
    indexes: indexNames.length,
    security_definer_functions: securityDefinerBlocks.length,
    explicit_function_grants: grantFunctions.length,
  },
  application_order: order,
  artifact_sha256: Object.fromEntries(Object.entries(files).map(([key, name]) => [name, sha256(text[key])])),
  stop_criteria: [
    'any preflight check fails',
    'target staging is not empty',
    'hash differs from certified package',
    'application order differs',
    'any SQL step returns an error',
    'post-apply object counts or contracts differ',
  ],
  rollback: 'discard_and_recreate_empty_staging_project; never continue from partial state',
  prohibited_actions: { database_connections: 0, sql_executions: 0, supabase_actions: 0, cloudflare_actions: 0, dns_actions: 0, production_actions: 0 },
  decision: failures.length === 0
    ? 'PHASE_2C_CANONICAL_BASELINE_STATIC_PREFLIGHT_CERTIFIED_READY_FOR_CONTROLLED_EMPTY_STAGING_APPLICATION'
    : 'PHASE_2C_CANONICAL_BASELINE_STATIC_PREFLIGHT_BLOCKED',
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = failures.length ? 1 : 0;
