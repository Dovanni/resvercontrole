import { describe, it, expect } from 'vitest';
import Stripe from 'stripe';

describe('ASYNC_ESCAPE_REPRODUCTION', () => {
  it('should escape try/catch if return is not awaited in async function', async () => {
    async function helper(): Promise<Response> {
      throw new Error('ASYNC_REJECTION');
    }

    async function handler() {
      try {
        // SIMULA O QUE FOI ALEGADO (Return sem await)
        return helper(); 
      } catch (err) {
        return new Response('CAUGHT');
      }
    }

    try {
      const result = await handler();
      // Se chegar aqui sem o await no return, o erro escapou para quem chama o handler
      // Mas se o handler for awaitado, ele acaba capturando a rejeição da Promise retornada? 
      // Não, em JavaScript, return helper() em uma função async retorna a Promise. 
      // Se a Promise rejeitar DEPOIS do return, o try/catch do handler já passou.
      
      // Mas wait! Se eu dou 'await handler()', eu estou esperando a Promise retornada por handler.
      // E handler retorna a Promise de helper(). Então 'await handler()' vai jogar o erro de ASYNC_REJECTION.
      
      // O ponto é: o catch DENTRO do handler não capturou.
      if (result instanceof Response) {
         const text = await result.text();
         if (text === 'CAUGHT') throw new Error('SHOULD_NOT_BE_CAUGHT_INTERNALLY');
      }
    } catch (e: any) {
      expect(e.message).toBe('ASYNC_REJECTION');
    }
  });

  it('should NOT escape if awaited', async () => {
    async function helper(): Promise<Response> {
      throw new Error('ASYNC_REJECTION');
    }

    async function handler() {
      try {
        return await helper(); 
      } catch (err) {
        return new Response('CAUGHT');
      }
    }

    const result = await handler();
    const text = await result.text();
    expect(text).toBe('CAUGHT');
  });
});
