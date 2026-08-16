import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState, useRef, useEffect } from 'react';

// Simulação da lógica de idempotência para teste unitário puro
function useIdempotencyPilot(empresaId: string | undefined, isPilotEnabled: boolean, isEdit: boolean) {
  const idempotencyKeyRef = useRef<string | null>(null);
  const submissionLockRef = useRef(false);
  const [pilotState, setPilotState] = useState<'idle' | 'prepared' | 'submitting' | 'ambiguous_failure' | 'definitive_failure' | 'confirmed' | 'cancelled'>('idle');

  useEffect(() => {
    idempotencyKeyRef.current = null;
    submissionLockRef.current = false;
    setPilotState('idle');
  }, [empresaId]);

  const initiateSave = (mutateFn: (key: string) => Promise<any>) => {
    if (submissionLockRef.current) return 'locked';
    
    if (isPilotEnabled && !isEdit) {
      if (pilotState === 'idle' || pilotState === 'definitive_failure' || pilotState === 'cancelled') {
        idempotencyKeyRef.current = crypto.randomUUID();
        setPilotState('prepared');
      }
      setPilotState('submitting');
    }
    
    submissionLockRef.current = true;
    
    const finalKey = (isPilotEnabled && !isEdit) 
      ? (idempotencyKeyRef.current || 'fallback') 
      : `legacy_${Date.now()}`;

    return mutateFn(finalKey);
  };

  const handleRpcResult = (error: any) => {
    if (!error) {
      if (isPilotEnabled && !isEdit) {
        setPilotState('confirmed');
        idempotencyKeyRef.current = null;
      }
      submissionLockRef.current = false;
      return;
    }

    if (isPilotEnabled && !isEdit) {
      const isAmbiguous = error.message?.toLowerCase().includes("timeout") || 
                         error.message?.toLowerCase().includes("network");
      if (isAmbiguous) {
        setPilotState('ambiguous_failure');
        // Lock liberado para permitir retry com a mesma chave
        submissionLockRef.current = false;
      } else {
        setPilotState('definitive_failure');
        idempotencyKeyRef.current = null;
        submissionLockRef.current = false;
      }
    } else {
      submissionLockRef.current = false;
    }
  };

  return { pilotState, idempotencyKeyRef, submissionLockRef, initiateSave, handleRpcResult };
}

describe('Purchase Idempotency Pilot Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. generates a valid UUID', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    expect(result.current.idempotencyKeyRef.current).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('2. creates key exactly once per session', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    let firstKey = '';
    act(() => { 
      result.current.initiateSave((key) => { firstKey = key; return Promise.resolve(); }); 
    });
    // Simula reset do lock após erro ambíguo para testar reuso
    result.current.submissionLockRef.current = false;
    act(() => {
      result.current.initiateSave((key) => {
        expect(key).toBe(firstKey);
        return Promise.resolve();
      });
    });
  });

  it('3. maintains stability after rerender', () => {
    const { result, rerender } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    const key = result.current.idempotencyKeyRef.current;
    rerender();
    expect(result.current.idempotencyKeyRef.current).toBe(key);
  });

  it('4. supports manual retry with same key after ambiguous failure', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    let usedKey = '';
    act(() => { result.current.initiateSave((key) => { usedKey = key; return Promise.resolve(); }); });
    act(() => { result.current.handleRpcResult({ message: 'Network timeout' }); });
    
    expect(result.current.pilotState).toBe('ambiguous_failure');
    expect(result.current.submissionLockRef.current).toBe(false);
    
    act(() => { result.current.initiateSave((key) => {
      expect(key).toBe(usedKey);
      return Promise.resolve();
    }); });
  });

  it('5. clears key on success', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    act(() => { result.current.handleRpcResult(null); });
    expect(result.current.idempotencyKeyRef.current).toBeNull();
    expect(result.current.pilotState).toBe('confirmed');
  });

  it('6. clears key on definitive failure', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    act(() => { result.current.handleRpcResult({ message: 'Invalid supplier' }); });
    expect(result.current.idempotencyKeyRef.current).toBeNull();
    expect(result.current.pilotState).toBe('definitive_failure');
  });

  it('7. clears key on company switch', () => {
    const { result, rerender } = renderHook(({ emp }) => useIdempotencyPilot(emp, true, false), {
      initialProps: { emp: 'emp1' }
    });
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    expect(result.current.idempotencyKeyRef.current).not.toBeNull();
    
    rerender({ emp: 'emp2' });
    expect(result.current.idempotencyKeyRef.current).toBeNull();
  });

  it('8. prevents double click in same tick (Synchronous Lock)', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    let calls = 0;
    const mutate = () => { calls++; return Promise.resolve(); };
    
    act(() => {
      result.current.initiateSave(mutate);
      result.current.initiateSave(mutate);
      result.current.initiateSave(mutate);
    });
    
    expect(calls).toBe(1);
  });

  it('9. prevents five rapid clicks', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    let calls = 0;
    const mutate = () => { calls++; return Promise.resolve(); };
    
    act(() => {
      for(let i=0; i<5; i++) result.current.initiateSave(mutate);
    });
    
    expect(calls).toBe(1);
  });

  it('10. uses Date.now() when pilot is disabled', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', false, false));
    let usedKey = '';
    act(() => { result.current.initiateSave((key) => { usedKey = key; return Promise.resolve(); }); });
    expect(usedKey).toContain('legacy_');
  });
  
  it('11. block edit mode from using pilot logic', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, true));
    let usedKey = '';
    act(() => { result.current.initiateSave((key) => { usedKey = key; return Promise.resolve(); }); });
    expect(usedKey).toContain('legacy_');
  });

  it('12. lock released after success', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    expect(result.current.submissionLockRef.current).toBe(true);
    act(() => { result.current.handleRpcResult(null); });
    expect(result.current.submissionLockRef.current).toBe(false);
  });

  it('13. lock released after definitive failure', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    act(() => { result.current.initiateSave(() => Promise.resolve()); });
    act(() => { result.current.handleRpcResult({ message: 'Error' }); });
    expect(result.current.submissionLockRef.current).toBe(false);
  });

  it('14. retry uses same key after lock release', () => {
    const { result } = renderHook(() => useIdempotencyPilot('emp1', true, false));
    let firstKey = '';
    act(() => { result.current.initiateSave((key) => { firstKey = key; return Promise.resolve(); }); });
    act(() => { result.current.handleRpcResult({ message: 'timeout' }); });
    
    let secondKey = '';
    act(() => { result.current.initiateSave((key) => { secondKey = key; return Promise.resolve(); }); });
    expect(secondKey).toBe(firstKey);
  });
});
