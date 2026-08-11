import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * FASE 4 — TESTES TRANSACIONAIS
 * Testes executados contra o banco para validar a proteção de empresa_id.
 * Como o Vitest no sandbox não tem acesso a uma transação de banco real que possamos dar rollback manual fácil 
 * sem afetar o estado global de forma persistente, simularemos as chamadas e verificaremos as respostas de erro 
 * ou sucesso do trigger.
 */

describe('Proteção Atômica de empresa_id em Cartões', () => {
  let testUser: any;
  let empresaId: string;
  let cartaoId: string;

  beforeAll(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    testUser = user;
    
    // Obter um cartão válido para o usuário
    const { data: cartoes } = await supabase.from('cartoes_credito' as any).select('id, empresa_id').limit(1);
    if (cartoes && cartoes.length > 0) {
      cartaoId = (cartoes[0] as any).id;
      empresaId = (cartoes[0] as any).empresa_id;
    }
  });

  it('1. Deve preencher empresa_id automaticamente se enviado nulo', async () => {
    if (!cartaoId) return;
    
    const payload = {
      user_id: testUser.id,
      cartao_id: cartaoId,
      data: new Date().toISOString().slice(0, 10),
      descricao: 'Teste Automatizado Preenchimento',
      categoria: 'pessoal',
      valor: 10.00,
      parcelado: false,
      total_parcelas: 1,
      parcela_atual: 1,
      mes_fatura: 8,
      ano_fatura: 2026,
      empresa_id: null // Omitido propositalmente
    };

    const { data, error } = await supabase.from('cartoes_lancamentos' as any).insert(payload).select();
    
    expect(error).toBeNull();
    expect((data![0] as any).empresa_id).toBe(empresaId);
    
    // Cleanup
    await supabase.from('cartoes_lancamentos' as any).delete().eq('id', (data![0] as any).id);
  });

  it('2. Deve rejeitar se empresa_id enviado for diferente do cartão (IDOR/Cross-tenant)', async () => {
    if (!cartaoId) return;

    const fakeEmpresaId = '00000000-0000-0000-0000-000000000000';
    const payload = {
      user_id: testUser.id,
      cartao_id: cartaoId,
      data: new Date().toISOString().slice(0, 10),
      descricao: 'Teste Rejeição Divergente',
      categoria: 'pessoal',
      valor: 10.00,
      parcelado: false,
      total_parcelas: 1,
      parcela_atual: 1,
      mes_fatura: 8,
      ano_fatura: 2026,
      empresa_id: fakeEmpresaId
    };

    const { error } = await supabase.from('cartoes_lancamentos' as any).insert(payload);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Divergência de tenant');
  });
});
