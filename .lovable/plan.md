# CNPJ Validation & Company Onboardng (2026 Ready)

Implementação de validação oficial de CNPJ (numérico e alfanumérico) no fluxo de cadastro do VEJAMAIS.

## Especificações Técnicas

### 1. CNPJ Alfanumérico 2026
- **Regex:** `^[A-Z0-9]{12}[0-9]{2}$`
- **Normalização:** Uppercase, sem máscara.
- **Validação:** Módulo 11 usando ASCII - 48 conforme Nota Técnica da Receita Federal.

### 2. Fluxo de Onboarding
1. **Validar:** Consulta externa (BrasilAPI) + Formato + DV.
2. **Exibir:** Dados cadastrais allowlisted (Razão Social, Fantasia, Situação, CNAE, Município, UF).
3. **Bloquear:** Situações não ATIVAS ou empresas já cadastradas.
4. **Confirmar:** Criação de empresa somente após validação e confirmação humana.

### 3. Segurança
- Rate limit por IP e hash de CNPJ.
- Server-side only (tanstack start server function).
- Proteção contra enumeração (generic messages no signup).
- Isolamento multiempresa preservado.

## Arquivos Criados/Modificados
- `src/lib/cnpj-validator.ts`: Lógica de validação e formatação.
- `src/lib/company-validation.functions.ts`: Server function de consulta oficial.
- `src/routes/cadastro.tsx`: UI atualizada com fluxo de validação.
- `src/lib/cnpj-validator.test.ts`: Testes unitários para regras 2026.
