import { z } from "zod";

/**
 * Normaliza CNPJ (remove máscara e converte para uppercase)
 */
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Validação de CNPJ (Numérico e Alfanumérico 2026)
 * Baseado na Nota Técnica 2024.001 da Receita Federal
 */
export function validateCnpj(cnpjRaw: string): boolean {
  const cnpj = normalizeCnpj(cnpjRaw);

  if (cnpj.length !== 14) return false;

  // CNPJs conhecidos inválidos (numéricos repetidos)
  const invalidCnpjs = [
    "00000000000000", "11111111111111", "22222222222222", "33333333333333",
    "44444444444444", "55555555555555", "66666666666666", "77777777777777",
    "88888888888888", "99999999999999"
  ];
  if (invalidCnpjs.includes(cnpj)) return false;

  // Cálculo de dígitos verificadores (Módulo 11)
  // Conforme orientação: valor ASCII - 48
  const getWeightValue = (char: string) => {
    const code = char.charCodeAt(0);
    return code - 48;
  };

  const calculateDV = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += getWeightValue(base[i]) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const base1 = cnpj.substring(0, 12);
  const dv1 = calculateDV(base1, weights1);
  
  const base2 = base1 + dv1;
  const dv2 = calculateDV(base2, weights2);

  return cnpj.endsWith(`${dv1}${dv2}`);
}

/**
 * Formata CNPJ com máscara
 */
export function formatCnpj(cnpj: string): string {
  const clean = normalizeCnpj(cnpj);
  if (clean.length !== 14) return cnpj;
  return clean.replace(
    /^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})([A-Z0-9]{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export const cnpjSchema = z.string().refine(validateCnpj, {
  message: "CNPJ inválido (numérico ou alfanumérico)",
});

