# CP-04 — release preflight (2026-10-23)

## CI — approved
SHA `7cc79f0860598c91db4e4866527aa863dd9567c8`:
- Actual Supabase Auth/RLS and RPC concurrency: https://github.com/Dovanni/resvercontrole/actions/runs/39875106218
- Unit: https://github.com/Dovanni/resvercontrole/actions/runs/39875106210
- Build: https://github.com/Dovanni/resvercontrole/actions/runs/39875106336
- PostgreSQL transactions: https://github.com/Dovanni/resvercontrole/actions/runs/39875106223
- Blog validation: success.

## Remote Supabase preflight — SELECT only
- payables: 329 rows
- user_company_access: 3 rows, all three active financial members
- payables with no active matching financial membership: 0
- authenticated already has SELECT, INSERT, UPDATE, DELETE on payables and SELECT on empresas/user_company_access.
- Current payables policy: permissive `own payables` for ALL on PUBLIC; must be replaced atomically with the reviewed four policies.
- Legacy payables must not be backfilled by description.

## Gates before migration or production deploy
1. Snapshot database/backups and ensure recovery path; record current schema and policy definitions.
2. Review application-level permissions for Matriz and multiempresa: isolated tests use two companies and admin/financeiro/vendedor, but not the special Matriz authorization layer.
3. Ensure series creation is atomic: the current frontend `insert(rows)` is a single PostgREST statement, but a DB constraint/trigger or RPC may be needed for stronger series completeness guarantees.
4. Review paid/cancelled direct UPDATE/DELETE policy: current proposed RLS controls role and ownership, but does not prohibit financial edits to settled rows via direct PostgREST; decide whether database triggers/RPC-only writes are required to enforce immutability.
5. Generate canonical migration using Supabase CLI; apply schema before app release; then RLS and RPC, grant EXECUTE only to authenticated after verification; validate catalog and rollback plan.
6. Verify frontend smoke tests for matrix admin and customer company on staging, then merge/deploy.

## Decision
**CI GO; production schema/deploy HOLD** pending the above integrity and compatibility gates. No production mutation in this review.
