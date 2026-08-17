import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState, useRef, useEffect } from 'react';

// Simulação da lógica de idempotência para teste unitário puro sem dependência de DOM/renderHook
function testIdempotencyLogic() {
  // Mock manual simplificado do ciclo de vida
  const state = {
    empresaId: 'emp1',
    isPilotEnabled: true,
    isEdit: false,
    pilotState: 'idle' as any,
    idempotencyKey: null as string | null,
    submissionLock: false
  };

  const initiateSave = (mutateFn: (key: string) => Promise<any>) => {
    if (state.submissionLock) return 'locked';
    
    if (state.isPilotEnabled && !state.isEdit) {
      if (state.pilotState === 'idle' || state.pilotState === 'definitive_failure' || state.pilotState === 'cancelled') {
        state.idempotencyKey = crypto.randomUUID();
        state.pilotState = 'prepared';
      }
      state.pilotState = 'submitting';
    }
    
    state.submissionLock = true;
    
    const finalKey = (state.isPilotEnabled && !state.isEdit) 
      ? (state.idempotencyKey || 'fallback') 
      : `legacy_${Date.now()}`;

    return mutateFn(finalKey);
  };

  const handleRpcResult = (error: any) => {
    if (!error) {
      if (state.isPilotEnabled && !state.isEdit) {
        state.pilotState = 'confirmed';
        state.idempotencyKey = null;
      }
      state.submissionLock = false;
      return;
    }

    if (state.isPilotEnabled && !state.isEdit) {
      const isAmbiguous = error.message?.toLowerCase().includes("timeout") || 
                         error.message?.toLowerCase().includes("network");
      if (isAmbiguous) {
        state.pilotState = 'ambiguous_failure';
        state.submissionLock = false;
      } else {
        state.pilotState = 'definitive_failure';
        state.idempotencyKey = null;
        state.submissionLock = false;
      }
    } else {
      state.submissionLock = false;
    }
  };

  const switchCompany = (newId: string) => {
    state.empresaId = newId;
    state.idempotencyKey = null;
    state.submissionLock = false;
    state.pilotState = 'idle';
  };

  return { state, initiateSave, handleRpcResult, switchCompany };
}

describe('Purchase Idempotency Pilot Logic (Pure Unit)', () => {
  it('1. generates a valid UUID', () => {
    const logic = testIdempotencyLogic();
    logic.initiateSave(() => Promise.resolve());
    expect(logic.state.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('2. creates key exactly once per session and reuses it', () => {
    const logic = testIdempotencyLogic();
    let firstKey = '';
    logic.initiateSave((key) => { firstKey = key; return Promise.resolve(); });
    
    logic.handleRpcResult({ message: 'timeout' });
    
    let secondKey = '';
    logic.initiateSave((key) => { secondKey = key; return Promise.resolve(); });
    expect(secondKey).toBe(firstKey);
  });

  it('3. supports manual retry with same key after ambiguous failure', () => {
    const logic = testIdempotencyLogic();
    let usedKey = '';
    logic.initiateSave((key) => { usedKey = key; return Promise.resolve(); });
    logic.handleRpcResult({ message: 'Network timeout' });
    
    expect(logic.state.pilotState).toBe('ambiguous_failure');
    expect(logic.state.submissionLock).toBe(false);
    
    logic.initiateSave((key) => {
      expect(key).toBe(usedKey);
      return Promise.resolve();
    });
  });

  it('4. clears key on success', () => {
    const logic = testIdempotencyLogic();
    logic.initiateSave(() => Promise.resolve());
    logic.handleRpcResult(null);
    expect(logic.state.idempotencyKey).toBeNull();
    expect(logic.state.pilotState).toBe('confirmed');
  });

  it('5. clears key on definitive failure', () => {
    const logic = testIdempotencyLogic();
    logic.initiateSave(() => Promise.resolve());
    logic.handleRpcResult({ message: 'Invalid supplier' });
    expect(logic.state.idempotencyKey).toBeNull();
    expect(logic.state.pilotState).toBe('definitive_failure');
  });

  it('6. clears key on company switch', () => {
    const logic = testIdempotencyLogic();
    logic.initiateSave(() => Promise.resolve());
    expect(logic.state.idempotencyKey).not.toBeNull();
    
    logic.switchCompany('emp2');
    expect(logic.state.idempotencyKey).toBeNull();
    expect(logic.state.pilotState).toBe('idle');
  });

  it('7. prevents double click in same tick (Synchronous Lock)', () => {
    const logic = testIdempotencyLogic();
    let calls = 0;
    const mutate = () => { calls++; return Promise.resolve(); };
    
    logic.initiateSave(mutate);
    logic.initiateSave(mutate);
    logic.initiateSave(mutate);
    
    expect(calls).toBe(1);
  });

  it('8. prevents five rapid clicks', () => {
    const logic = testIdempotencyLogic();
    let calls = 0;
    const mutate = () => { calls++; return Promise.resolve(); };
    
    for(let i=0; i<5; i++) logic.initiateSave(mutate);
    
    expect(calls).toBe(1);
  });

  it('9. uses Date.now() when pilot is disabled', () => {
    const logic = testIdempotencyLogic();
    logic.state.isPilotEnabled = false;
    let usedKey = '';
    logic.initiateSave((key) => { usedKey = key; return Promise.resolve(); });
    expect(usedKey).toContain('legacy_');
  });
  
  it('10. block edit mode from using pilot logic', () => {
    const logic = testIdempotencyLogic();
    logic.state.isEdit = true;
    let usedKey = '';
    logic.initiateSave((key) => { usedKey = key; return Promise.resolve(); });
    expect(usedKey).toContain('legacy_');
  });

  it('11. lock released after success', () => {
    const logic = testIdempotencyLogic();
    logic.initiateSave(() => Promise.resolve());
    expect(logic.state.submissionLock).toBe(true);
    logic.handleRpcResult(null);
    expect(logic.state.submissionLock).toBe(false);
  });

  it('12. lock released after definitive failure', () => {
    const logic = testIdempotencyLogic();
    logic.initiateSave(() => Promise.resolve());
    logic.handleRpcResult({ message: 'Error' });
    expect(logic.state.submissionLock).toBe(false);
  });
});
