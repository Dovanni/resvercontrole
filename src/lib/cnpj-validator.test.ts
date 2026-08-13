import { describe, it, expect } from "vitest";
import { validateCnpj, normalizeCnpj, formatCnpj } from "./cnpj-validator";

describe("CNPJ Validator (Numeric & Alphanumeric 2026)", () => {
  it("should validate valid numeric CNPJ", () => {
    expect(validateCnpj("11.222.333/0001-81")).toBe(true);
    expect(validateCnpj("11222333000181")).toBe(true);
  });

  it("should reject numeric CNPJ with invalid DV", () => {
    expect(validateCnpj("11.222.333/0001-00")).toBe(false);
  });

  it("should validate official alphanumeric CNPJ test case", () => {
    // Test Case: 00.000.000/E08G-12
    // A: 65, B: 66, ... E: 69, G: 71
    // E (69-48=21), G (71-48=23)
    // CNPJ: 00000000E08G12
    expect(validateCnpj("00.000.000/E08G-12")).toBe(true);
  });

  it("should validate custom alphanumeric CNPJ", () => {
    // ABC12345678923 (Calculado no turno anterior)
    expect(validateCnpj("ABC12345678923")).toBe(true);
  });

  it("should normalize correctly", () => {
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCnpj("ABC.123/4567-89")).toBe("ABC123456789");
  });

  it("should format correctly", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("00000000E08G12")).toBe("00.000.000/E08G-12");
  });

  it("should reject known invalid repeated patterns", () => {
    expect(validateCnpj("00000000000000")).toBe(false);
    expect(validateCnpj("11111111111111")).toBe(false);
  });

  it("should reject invalid lengths", () => {
    expect(validateCnpj("1234567890123")).toBe(false);
    expect(validateCnpj("123456789012345")).toBe(false);
  });
});

describe("CNPJ Error Logic Proofs", () => {
  it("should detect alphanumeric CNPJ for provider support logic", () => {
    const numeric = "11222333000181";
    const alphanumeric = "00000000E08G12";
    expect(/[A-Z]/.test(numeric)).toBe(false);
    expect(/[A-Z]/.test(alphanumeric)).toBe(true);
  });
});

