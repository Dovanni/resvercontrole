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

function splitSqlStatements(sql) {
  const statements = [];
  let state = 'normal', dollar = '', start = 0;
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
    if (c === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (m) { dollar = m[0]; state = 'dollar'; i += dollar.length - 1; continue; }
    }
    if (c === ';') {
      const statement = sql.slice(start, i + 1).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function splitTopLevelCsv(value) {
  const parts = [];
  let state = 'normal', depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i], n = value[i + 1];
    if (state === 'single') { if (c === "'" && n === "'") { i++; continue; } if (c === "'") state = 'normal'; continue; }
    if (state === 'double') { if (c === '"' && n === '"') { i++; continue; } if (c === '"') state = 'normal'; continue; }
    if (c === "'") { state = 'single'; continue; }
    if (c === '"') { state = 'double'; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function balancedParenthesized(value, openIndex) {
  let state = 'normal', depth = 0;
  for (let i = openIndex; i < value.length; i++) {
    const c = value[i], n = value[i + 1];
    if (state === 'single') { if (c === "'" && n === "'") { i++; continue; } if (c === "'") state = 'normal'; continue; }
    if (state === 'double') { if (c === '"' && n === '"') { i++; continue; } if (c === '"') state = 'normal'; continue; }
    if (c === "'") { state = 'single'; continue; }
    if (c === '"') { state = 'double'; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return value.slice(openIndex + 1, i);
  }
  return '';
}

function knownColumnReferences(fragment, candidateColumns) {
  const sqlKeywords = new Set([
    'add', 'alter', 'and', 'as', 'asc', 'check', 'column', 'constraint',
    'create', 'default', 'delete', 'desc', 'exists', 'foreign', 'from',
    'if', 'in', 'index', 'is', 'key', 'not', 'null', 'on', 'or', 'primary',
    'references', 'set', 'table', 'unique', 'update', 'where',
  ]);
  const masked = fragment
    .replace(/\bREFERENCES\s+(?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*\s*\([^)]*\)/gi, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, ' ')
    .replace(/"(?:""|[^"])*"/g, ' ');
  return [...new Set(
    [...masked.matchAll(/\b([a-z_][a-z0-9_]*)\b/gi)]
      .map((match) => match[1].toLowerCase())
      .filter((name) => candidateColumns.has(name) && !sqlKeywords.has(name))
  )];
}

function validateSequentialConstraintAndIndexColumns(sql, finalTableColumns) {
  const available = new Map();
  const issues = [];
  const candidateColumns = new Set(
    [...finalTableColumns.values()].flatMap((columns) => [...columns])
  );
  let constraintsScanned = 0;
  let indexesScanned = 0;
  let columnReferencesScanned = 0;
  let alterTableStatementsScanned = 0;
  let alterColumnsScanned = 0;
  let dropColumnsScanned = 0;

  const validate = (table, fragment, kind) => {
    const currentColumns = available.get(table) || new Set();
    const references = knownColumnReferences(fragment, candidateColumns);
    columnReferencesScanned += references.length;
    for (const column of references) {
      if (!currentColumns.has(column)) issues.push({ kind, table, column });
    }
  };

  for (const statement of splitSqlStatements(sql)) {
    const create = statement.match(/\bCREATE TABLE(?: IF NOT EXISTS)? public\.([a-z_][a-z0-9_]*)\s*\(/i);
    if (create) {
      const table = create[1].toLowerCase();
      const openIndex = statement.indexOf('(', create.index);
      const body = balancedParenthesized(statement, openIndex);
      const segments = splitTopLevelCsv(body);
      const columns = new Set();
      for (const segment of segments) {
        const cleanSegment = segment.replace(/--.*$/gm, ' ').trim();
        if (/^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i.test(cleanSegment)) continue;
        const column = cleanSegment.match(/^\s*([a-z_][a-z0-9_]*)\s+/i)?.[1]?.toLowerCase();
        if (column) columns.add(column);
      }
      available.set(table, columns);
      for (const segment of segments) {
        const cleanSegment = segment.replace(/--.*$/gm, ' ').trim();
        if (/^(?:CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|EXCLUDE)\b/i.test(cleanSegment)) {
          constraintsScanned++;
          validate(table, cleanSegment, 'CREATE_TABLE_CONSTRAINT');
        } else if (/\b(?:PRIMARY\s+KEY|UNIQUE|CHECK|REFERENCES)\b/i.test(cleanSegment)) {
          constraintsScanned++;
          const column = cleanSegment.match(/^\s*([a-z_][a-z0-9_]*)\s+/i)?.[1]?.toLowerCase();
          if (column && !columns.has(column)) issues.push({ kind: 'INLINE_COLUMN_CONSTRAINT', table, column });
          validate(table, cleanSegment, 'INLINE_COLUMN_CONSTRAINT');
        }
      }
      continue;
    }

    const alterTable = statement.match(/\bALTER TABLE public\.([a-z_][a-z0-9_]*)/i);
    if (alterTable) {
      alterTableStatementsScanned++;
      const table = alterTable[1].toLowerCase();
      if (!available.has(table)) issues.push({ kind: 'ALTER_TABLE_TARGET', table });
    }

    const addColumnTarget = statement.match(/\bALTER TABLE public\.([a-z_][a-z0-9_]*)/i);
    const addColumns = [...statement.matchAll(/\bADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)];
    if (addColumnTarget && addColumns.length > 0) {
      const table = addColumnTarget[1].toLowerCase();
      for (const addColumn of addColumns) {
        const column = addColumn[1].toLowerCase();
        if (!available.has(table)) issues.push({ kind: 'ADD_COLUMN_TARGET', table, column });
        else available.get(table).add(column);
      }
      if (/\b(?:PRIMARY\s+KEY|UNIQUE|CHECK|REFERENCES)\b/i.test(statement)) {
        constraintsScanned++;
        validate(table, statement, 'ADD_COLUMN_CONSTRAINT');
      }
      continue;
    }

    const dropColumn = statement.match(/\bALTER TABLE public\.([a-z_][a-z0-9_]*)\s+DROP COLUMN(?: IF EXISTS)?\s+([a-z_][a-z0-9_]*)/i);
    if (dropColumn) {
      const table = dropColumn[1].toLowerCase(), column = dropColumn[2].toLowerCase();
      dropColumnsScanned++;
      if (!available.get(table)?.has(column)) issues.push({ kind: 'DROP_COLUMN_TARGET', table, column });
      else available.get(table).delete(column);
      continue;
    }

    const alterColumn = statement.match(/\bALTER TABLE public\.([a-z_][a-z0-9_]*)\s+ALTER COLUMN\s+([a-z_][a-z0-9_]*)/i);
    if (alterColumn) {
      const table = alterColumn[1].toLowerCase(), column = alterColumn[2].toLowerCase();
      alterColumnsScanned++;
      if (!available.get(table)?.has(column)) issues.push({ kind: 'ALTER_COLUMN_TARGET', table, column });
      continue;
    }

    const addConstraint = statement.match(/\bALTER TABLE public\.([a-z_][a-z0-9_]*)\s+ADD CONSTRAINT\s+([a-z_][a-z0-9_]*)/i);
    if (addConstraint) {
      const table = addConstraint[1].toLowerCase();
      constraintsScanned++;
      if (!available.has(table)) issues.push({ kind: 'CONSTRAINT_TARGET', table, constraint: addConstraint[2] });
      validate(table, statement, 'ALTER_TABLE_CONSTRAINT');
      continue;
    }

    const createIndex = statement.match(/\bCREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)\s+ON public\.([a-z_][a-z0-9_]*)/i);
    if (createIndex) {
      const table = createIndex[2].toLowerCase();
      indexesScanned++;
      if (!available.has(table)) issues.push({ kind: 'INDEX_TARGET', table, index: createIndex[1] });
      validate(table, statement, 'INDEX');
    }
  }
  return {
    issues,
    constraintsScanned,
    indexesScanned,
    columnReferencesScanned,
    alterTableStatementsScanned,
    alterColumnsScanned,
    dropColumnsScanned,
  };
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

const sequentialDependencies = validateSequentialConstraintAndIndexColumns(text.schema, tableColumns);
check(sequentialDependencies.issues.length === 0, 'SEQUENTIAL_CONSTRAINT_INDEX_COLUMNS_EXIST', JSON.stringify(sequentialDependencies.issues));
check(sequentialDependencies.constraintsScanned > 0, 'SEQUENTIAL_CONSTRAINTS_SCANNED', `count=${sequentialDependencies.constraintsScanned}`);
check(sequentialDependencies.indexesScanned === 57, 'SEQUENTIAL_INDEXES_SCANNED', `count=${sequentialDependencies.indexesScanned}`);
check(sequentialDependencies.columnReferencesScanned > 0, 'SEQUENTIAL_COLUMN_REFERENCES_SCANNED', `count=${sequentialDependencies.columnReferencesScanned}`);
check(sequentialDependencies.alterTableStatementsScanned === 78, 'SEQUENTIAL_ALTER_TABLE_TARGETS_SCANNED', `count=${sequentialDependencies.alterTableStatementsScanned}`);
check(sequentialDependencies.alterColumnsScanned === 5, 'SEQUENTIAL_ALTER_COLUMNS_SCANNED', `count=${sequentialDependencies.alterColumnsScanned}`);

const diagnosticsColumns = tableColumns.get('stripe_webhook_runtime_diagnostics') || new Set();
check(diagnosticsColumns.has('expires_at'), 'STRIPE_DIAGNOSTICS_EXPIRES_AT_EXISTS');
check(
  /CREATE TABLE public\.stripe_webhook_runtime_diagnostics\s*\([\s\S]*?expires_at\s+timestamptz\s+NOT NULL\s+DEFAULT\s*\(now\(\)\s*\+\s*interval\s*'7 days'\)[\s\S]*?\n\);/i.test(text.schema),
  'STRIPE_DIAGNOSTICS_EXPIRES_AT_CANONICAL_DEFINITION'
);

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
const phase2dHeader = '-- Phase 2-D certified for controlled application exclusively to empty Supabase staging hoalgniwydgydqaugqph; executable SQL unchanged.';
check(text.schema.split('\n')[1] === phase2dHeader, 'DECLARATIVE_HEADER_SCHEMA_PRESERVED');
check(text.functions.split('\n')[1] === phase2dHeader, 'DECLARATIVE_HEADER_FUNCTIONS_PRESERVED');
check(text.security.split('\n')[1] === phase2dHeader, 'DECLARATIVE_HEADER_SECURITY_PRESERVED');
check(applicationPlan.target_project_ref === 'hoalgniwydgydqaugqph', 'PLAN_TARGET_PROJECT_REF_EXACT');
check(applicationPlan.status === 'EXPIRES_AT_CORRECTED_STATICALLY_CERTIFIED_AWAITING_HUMAN_APPROVAL', 'PLAN_APPLICATION_BLOCKED_PENDING_APPROVAL');
check(
  applicationPlan.phase_2e_order_correction?.final_architecture_changed === false
    && applicationPlan.phase_2e_order_correction?.moved_existing_statements_only?.length === 2
    && applicationPlan.phase_2e_order_correction?.application_blocked_pending_human_approval === true,
  'PLAN_PHASE_2E_SCOPE_EXACT'
);
check(
  applicationPlan.phase_2f_expires_at_correction?.source_head_before_phase_2f === '115a008e7a766a61556ee1af8f53c2b1f2b2241e'
    && applicationPlan.phase_2f_expires_at_correction?.target_table === 'public.stripe_webhook_runtime_diagnostics'
    && applicationPlan.phase_2f_expires_at_correction?.column_definition === "expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')"
    && applicationPlan.phase_2f_expires_at_correction?.application_blocked_pending_human_approval === true,
  'PLAN_PHASE_2F_SCOPE_EXACT'
);

const result = {
  protocol: 'VEJAMAIS-CLOUDFLARE-MIGRATION-PHASE-2F-EXPIRES-AT-CATALOG-PREFLIGHT-v1',
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
    sequential_constraints_scanned: sequentialDependencies.constraintsScanned,
    sequential_indexes_scanned: sequentialDependencies.indexesScanned,
    sequential_column_references_scanned: sequentialDependencies.columnReferencesScanned,
    sequential_alter_table_statements_scanned: sequentialDependencies.alterTableStatementsScanned,
    sequential_alter_columns_scanned: sequentialDependencies.alterColumnsScanned,
    sequential_drop_columns_scanned: sequentialDependencies.dropColumnsScanned,
    sequential_dependency_failures: sequentialDependencies.issues.length,
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
    ? 'PHASE_2F_EXPIRES_AT_CATALOG_DEPENDENCIES_STATICALLY_CERTIFIED_AWAITING_HUMAN_APPROVAL'
    : 'PHASE_2F_EXPIRES_AT_CATALOG_DEPENDENCIES_STATIC_PREFLIGHT_BLOCKED',
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = failures.length ? 1 : 0;
