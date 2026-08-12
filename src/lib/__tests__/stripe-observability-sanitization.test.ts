import { describe, it, expect, vi } from 'vitest';
import { classifyError, STAGES, REASON_CODES } from '../stripe-observability.server';

describe('Stripe Observability Sanitization', () => {
  it('PGRST202 → SIGNATURE_NOT_FOUND', () => {
    const error = { code: 'PGRST202', message: 'Function signature not found' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_SIGNATURE_NOT_FOUND);
    expect(result.upstream_code).toBe('PGRST202');
  });

  it('42501 → AUTHORIZATION_REJECTED', () => {
    const error = { code: '42501', message: 'permission denied' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_AUTHORIZATION_REJECTED);
    expect(result.upstream_code).toBe('42501');
  });

  it('HTTP 401 → AUTHORIZATION_REJECTED', () => {
    const error = { status: 401, message: 'Unauthorized' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_AUTHORIZATION_REJECTED);
    expect(result.upstream_http_status).toBe(401);
  });

  it('23505 → DATABASE_CONFLICT', () => {
    const error = { code: '23505', message: 'duplicate key value' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_DATABASE_CONFLICT);
    expect(result.upstream_code).toBe('23505');
  });

  it('fetch rejection → TRANSPORT_FAILED', () => {
    const error = { message: 'Failed to fetch' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_TRANSPORT_FAILED);
  });

  it('timeout → TRANSPORT_FAILED', () => {
    const error = { message: 'network timeout' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_TRANSPORT_FAILED);
  });

  it('error desconhecido → UNEXPECTED_FAILURE', () => {
    const error = { code: 'UNKNOWN_999', message: 'Some weird error' };
    const result = classifyError(error);
    expect(result.reason_code).toBe(REASON_CODES.RESERVATION_RPC_UNEXPECTED_FAILURE);
  });
});
