# VEJAMAIS ERP — Stripe Sandbox Validated Baseline

Date: 2026-08-31
Environment: Sandbox / staging
Status: VALIDATED

## Restoration anchors

- Deployed application commit: `80c663455bbec929275d89c479eae519ef1fe70d`
- Commit message: `fix(billing): hide checkout CTA for enterprise trial`
- Source branch at validation: `migration/cloudflare-staging`
- Baseline branch: `baseline/stripe-sandbox-validated-2026-08-31`
- Cloudflare deploy workflow: `Deploy Cloudflare Staging`
- Validated workflow run: `#31` — conclusion `success`
- Supabase migration version: `20260831124358`
- Supabase migration name: `fix_stripe_invoice_subscription_resolution`
- Recorded migration file: `supabase/migrations/20260831124358_fix_stripe_invoice_subscription_resolution.sql`

## Validated billing invariants

1. Institutional matrix remains `billing_mode=institutional`, permanently active, and has no Stripe commercial subscription binding.
2. `essential_trial + trialing` remains eligible to start the first commercial checkout.
3. `enterprise_monthly + trialing` is already contracted and must not show or allow a second checkout CTA.
4. Server-side checkout rejects an existing Stripe-managed subscription, providing a second duplicate-checkout barrier.
5. Stripe Sandbox checkout, `checkout.session.completed`, `customer.subscription.created`, and `invoice.paid` were validated end-to-end.
6. A zero-value trial invoice is processed without prematurely setting the subscription to paid/active.
7. Invoice subscription resolution supports the nested Stripe invoice path `lines.data[*].parent.subscription_item_details.subscription` and rejects ambiguous multi-subscription invoices.
8. The validated enterprise trial remains `trialing`; the payment status is not promoted by the zero-value trial invoice.
9. Sandbox/live separation remains enforced by environment-specific price/key selection and Stripe session livemode checks.
10. No Stripe LIVE keys or LIVE checkout activation are part of this baseline.

## Supabase function security contract

`public.process_stripe_webhook_event(...)` at baseline:

- `SECURITY DEFINER`: enabled
- `search_path`: `pg_catalog, public, pg_temp`
- Execute ACL: `postgres`, `service_role`
- No execute grant to `anon` or `authenticated`

## Recovery procedure

For application-code rollback, restore the deployed application to commit:

`80c663455bbec929275d89c479eae519ef1fe70d`

For database contract reconstruction, use the recorded migration artifact only after reviewing the target database state and migration history. Do not blindly re-run it against a database where migration `20260831124358` is already present.

## Freeze rule

Treat this baseline as the last known-good Stripe Sandbox checkpoint before any Stripe LIVE configuration or activation. LIVE preparation should be performed separately and must not overwrite Sandbox secrets or remove the Sandbox/live boundary controls.
