import { z } from "zod";

export const STAGES = {
  REQUEST_VALIDATED: "REQUEST_VALIDATED",
  RESERVATION_RPC_STARTED: "RESERVATION_RPC_STARTED",
  RESERVATION_RPC_RETURNED: "RESERVATION_RPC_RETURNED",
  RESERVATION_RESULT_VALIDATED: "RESERVATION_RESULT_VALIDATED",
  STRIPE_CLIENT_CONSTRUCTION_STARTED: "STRIPE_CLIENT_CONSTRUCTION_STARTED",
  STRIPE_CLIENT_CONSTRUCTED: "STRIPE_CLIENT_CONSTRUCTED",
  STRIPE_REQUEST_PREPARED: "STRIPE_REQUEST_PREPARED",
  STRIPE_TRANSPORT_STARTED: "STRIPE_TRANSPORT_STARTED",
  STRIPE_RESPONSE_RECEIVED: "STRIPE_RESPONSE_RECEIVED",
  STRIPE_CHECKOUT_STARTED: "STRIPE_CHECKOUT_STARTED",
  HTTP_RESPONSE_CREATED: "HTTP_RESPONSE_CREATED"
} as const;

export const REASON_CODES = {
  RESERVATION_RPC_TRANSPORT_FAILED: "RESERVATION_RPC_TRANSPORT_FAILED",
  RESERVATION_RPC_AUTHORIZATION_REJECTED: "RESERVATION_RPC_AUTHORIZATION_REJECTED",
  RESERVATION_RPC_SIGNATURE_NOT_FOUND: "RESERVATION_RPC_SIGNATURE_NOT_FOUND",
  RESERVATION_RPC_DATABASE_CONFLICT: "RESERVATION_RPC_DATABASE_CONFLICT",
  RESERVATION_RPC_RESPONSE_EMPTY: "RESERVATION_RPC_RESPONSE_EMPTY",
  RESERVATION_RPC_RESPONSE_INVALID: "RESERVATION_RPC_RESPONSE_INVALID",
  RESERVATION_RPC_UNEXPECTED_FAILURE: "RESERVATION_RPC_UNEXPECTED_FAILURE",
  STRIPE_CLIENT_KEY_MISSING: "STRIPE_CLIENT_KEY_MISSING",
  STRIPE_CLIENT_KEY_FORMAT_INVALID: "STRIPE_CLIENT_KEY_FORMAT_INVALID",
  STRIPE_CLIENT_KEY_MODE_MISMATCH: "STRIPE_CLIENT_KEY_MODE_MISMATCH",
  STRIPE_CLIENT_CONSTRUCTION_FAILED: "STRIPE_CLIENT_CONSTRUCTION_FAILED"
} as const;

export const ALLOWED_UPSTREAM_CODES = [
  "PGRST202",
  "PGRST203",
  "42501",
  "23505"
] as const;

export type Stage = keyof typeof STAGES;
export type ReasonCode = keyof typeof REASON_CODES;
export type UpstreamCode = (typeof ALLOWED_UPSTREAM_CODES)[number];

export interface SanitizedError {
  error: "CHECKOUT_INITIALIZATION_FAILED";
  contract_version: "reservation-observability-v2";
  trace_id: string;
  stage: Stage;
  reason_code: ReasonCode;
  upstream_code: UpstreamCode | null;
  upstream_http_status: number | null;
}

export function classifyError(error: any): { reason_code: ReasonCode; upstream_code: UpstreamCode | null; upstream_http_status: number | null } {
  // Check for our custom internal error structure from getStripeClient
  if (error?.__isStripeClientError) {
    return {
      reason_code: error.reason_code as ReasonCode,
      upstream_code: null,
      upstream_http_status: null
    };
  }

  // PGRST202 ou PGRST203 -> RESERVATION_RPC_SIGNATURE_NOT_FOUND
  if (error?.code === "PGRST202" || error?.code === "PGRST203") {
    return {
      reason_code: "RESERVATION_RPC_SIGNATURE_NOT_FOUND",
      upstream_code: error.code as UpstreamCode,
      upstream_http_status: null
    };
  }

  // 42501 ou HTTP 401/403 -> RESERVATION_RPC_AUTHORIZATION_REJECTED
  if (error?.code === "42501") {
    return {
      reason_code: "RESERVATION_RPC_AUTHORIZATION_REJECTED",
      upstream_code: "42501",
      upstream_http_status: null
    };
  }
  
  // Se for um erro do PostgREST com status HTTP
  if (error?.status === 401 || error?.status === 403) {
    return {
      reason_code: "RESERVATION_RPC_AUTHORIZATION_REJECTED",
      upstream_code: null,
      upstream_http_status: error.status
    };
  }

  // 23505 -> RESERVATION_RPC_DATABASE_CONFLICT
  if (error?.code === "23505") {
    return {
      reason_code: "RESERVATION_RPC_DATABASE_CONFLICT",
      upstream_code: "23505",
      upstream_http_status: null
    };
  }

  // erro de rede, timeout ou fetch rejection -> RESERVATION_RPC_TRANSPORT_FAILED
  if (error?.message?.includes("fetch") || error?.message?.includes("network") || error?.message?.includes("timeout") || error?.name === "AbortError") {
    return {
      reason_code: "RESERVATION_RPC_TRANSPORT_FAILED",
      upstream_code: null,
      upstream_http_status: null
    };
  }

  return {
    reason_code: "RESERVATION_RPC_UNEXPECTED_FAILURE",
    upstream_code: null,
    upstream_http_status: null
  };
}
