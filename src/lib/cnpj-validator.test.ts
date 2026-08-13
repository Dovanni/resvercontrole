import { describe, it, expect } from "vitest";
import { validateCnpj, normalizeCnpj, formatCnpj } from "./cnpj-validator";

describe("CNPJ Validator (Numeric & Alphanumeric 2026)", () => {
  it("should validate valid numeric CNPJ", () => {
    // Exemplo de CNPJ numérico válido
    expect(validateCnpj("11.222.333/0001-81")).toBe(true);
    expect(validateCnpj("11222333000181")).toBe(true);
  });

  it("should reject numeric CNPJ with invalid DV", () => {
    expect(validateCnpj("11.222.333/0001-00")).toBe(false);
  });

  it("should validate valid alphanumeric CNPJ (2026 rule)", () => {
    // Exemplo de CNPJ alfanumérico baseado na regra:
    // Posições 1-12 podem ser letras.
    // Cálculo: ASCII - 48
    // 'A' = 65 -> 65 - 48 = 17
    // Vamos usar um exemplo teórico que passe no módulo 11
    // Nota: Em testes reais, precisaríamos de um gerador oficial, 
    // mas a lógica do Módulo 11 com ASCII - 48 é a implementada.
    
    // Exemplo simulado: "ABC123456789"
    // Pesos: 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2
    // A(17)*5 + B(18)*4 + C(19)*3 + 1(1)*2 + 2(2)*9 + 3(3)*8 + 4(4)*7 + 5(5)*6 + 6(6)*5 + 7(7)*4 + 8(8)*3 + 9(9)*2
    // 85 + 72 + 57 + 2 + 18 + 24 + 28 + 30 + 30 + 28 + 24 + 18 = 416
    // 416 % 11 = 9. Remainder 9 >= 2 -> DV1 = 11 - 9 = 2.
    // DV2 cálculo... (simplificando para o teste passar com a lógica)
    
    // Usando um exemplo que calculamos manualmente ou mockamos
    const validAlpha = "ABC123456789"; 
    // Pesos weights1: [5,4,3,2,9,8,7,6,5,4,3,2]
    // A: 65-48=17. B: 66-48=18. C: 67-48=19. 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9
    // sum1 = 17*5+18*4+19*3 + 1*2+2*9+3*8+4*7+5*6+6*5+7*4+8*3+9*2
    // sum1 = 85+72+57 + 2+18+24+28+30+30+28+24+18 = 416
    // rem1 = 416 % 11 = 9. DV1 = 11-9 = 2.
    
    // sum2 weights2: [6,5,4,3,2,9,8,7,6,5,4,3,2]
    // sum2 = 17*6+18*5+19*4 + 1*3+2*2+3*9+4*8+5*7+6*6+7*5+8*4+9*3 + 2*2
    // sum2 = 102+90+76 + 3+4+27+32+35+36+35+32+27 + 4 = 503
    // rem2 = 503 % 11 = 8. DV2 = 11-8 = 3.
    
    const alphaCnpj = "ABC12345678923";
    expect(validateCnpj(alphaCnpj)).toBe(true);
  });

  it("should normalize and format correctly", () => {
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCnpj("abc-123")).toBe("ABC123");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("ABC12345678923")).toBe("AB.C12.345/6789-23");
  });

  it("should reject invalid characters", () => {
    // Normalize remove caracteres especiais, mas validateCnpj checa length
    expect(validateCnpj("12.345.678/0001-2@")).toBe(false);
  });
});
