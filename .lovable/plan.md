---
title: CNPJ Validation Final Audit and Corrections
description: Protocol for material and visual audit of CNPJ validation, including alphanumeric support and security hardening.
type: feature
---

# VEJAMAIS_CNPJ_VALIDATION_FINAL_MATERIAL_AND_VISUAL_AUDIT

## Objective
Audit and correct CNPJ validation logic to support alphanumeric formats (2026), ensure provider classification transparency (BrasilAPI as third-party, not official), and harden security (rate limiting, atomic creation, IDOR protection).

## Material Audit (Phase 1)
- **Endpoint**: `https://brasilapi.com.br/api/cnpj/v1/${normalized}`
- **Alphanumeric Support**: Local validation uses Módulo 11 (ASCII - 48).
- **Provider Status**: Reclassified to `THIRD_PARTY_PUBLIC_DATA_PROVIDER`. "Official" claims removed.
- **Test Case**: `00.000.000/E08G-12` (First official alphanumeric CNPJ).
- **Fallback**: If provider fails or lacks alpha support, local validation holds, creation requires human confirmation.

## Physical Route (Phase 2)
- **Target**: `POST /api/public/company/validate-cnpj`
- **Isolation**: Provider payload stripped of PII (QSA, personal data) before returning to client.
- **Contract**: Strictly limited to `valid`, `status`, `reason_code`, and a sanitized `company` object.

## Security Hardening (Phase 3 & 4)
- **Rate Limit**: Transition from memory-only to durable/persistent via Supabase RPCs.
- **Uniqueness**: `documento` column in `public.empresas` must have a UNIQUE index.
- **Atomic Creation**: `create_pending_onboarding` RPC handles reservation to prevent duplicates.

## Verification Suite (Phase 6)
- 32 mandatory test cases covering numeric, alphanumeric, DVs, masks, provider failures, rate limits, and multi-tenancy.
- Client bundle inspection to ensure no secrets (BrasilAPI requires no key, but check environment leaks).

## Visual Preview (Phase 7)
- Responsive states for empty, invalid, loading, active, inactive, and existing company scenarios.
- Distinct confirmation button ("Confirmar dados e cadastrar empresa").
