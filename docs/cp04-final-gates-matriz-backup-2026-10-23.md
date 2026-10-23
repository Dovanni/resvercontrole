# CP-04 — Final gate: Matriz / RPC / backup (2026-10-23)

## Evidence
- Matriz admin server endpoint `getMatrizPanel` authenticates the current identity and validates `MATRIZ_ADMIN_USER_IDS` before importing the privileged Supabase client. Its permission is separate from tenant `payables` RLS.
- Matriz tests: `matriz-authorization.test.ts` (reject tenant admin, mismatched/revoked identity, allow explicitly configured ID) and `matriz-access.test.ts` (exact ID match).
- Actual Matriz login and panel data have **not** been smoke-tested against production in this audit. Do not mark functional acceptance complete.
- The production CP-04 RPC is absent; `docs/cp04-rpc-execute-release-gate.sql` is **not executed**.
- Supabase project is ACTIVE_HEALTHY, with no development branches. The available connector does **not** expose backup listing/restore verification; do not equate healthy project with verified backup.
- All six workflows green on `e39a11228054df191da2c0decbeb2a12f2b8dcc3`. Commit `f60a21c3a6365758ca0bc6963d550140749086ac` introduces only staged GRANT SQL; rerun CI on current HEAD before merge.

## Production go/no-go
1. Confirm actual recoverable backup/PITR or tested logical backup outside production, with retention and restoration procedure.
2. Run a real, read-only Matriz smoke test (admin allowed, tenant admin denied, panel lists expected users/companies/subscriptions); avoid exposing PII in logs.
3. Reconfirm schema/RLS/RPC/trigger and all permissions after controlled migrations; execute GRANT only after verification.
4. Confirm finance payment/estorno workflow compatibility with the new trigger, including updates on already paid rows.
5. Complete CI on current SHA, review PR #38, then merge and deploy with post-deploy health checks.

**Decision: HOLD production mutations and merge until these gates have evidence.**
