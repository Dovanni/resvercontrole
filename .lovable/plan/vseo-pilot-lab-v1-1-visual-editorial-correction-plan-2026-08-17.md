# VSEO Pilot Lab v1.1 Visual & Editorial Correction Plan

## Objective
Correct visual non-conformities in the VSEO Pilot Lab v1.1 while maintaining total isolation in the `feature/vseo-mock-pilot-v1-1` branch.

## 1. Brand Normalization
- Update `src/features/vseo-pilot/mockArticles.ts`:
  - Change `author` to `Equipe Editorial VEJAMAIS ERP — Conteúdo Piloto`.
  - Update `content` to include `VEJAMAIS ERP` instead of `VEJAMAIS`.
  - Update `metaTitle`, `metaDescription`.
- Update `src/routes/vseo-pilot/index.tsx`:
  - Ensure title uses `VEJAMAIS ERP`.
- Update `src/routes/vseo-pilot/blog/index.tsx`:
  - Ensure header uses `VEJAMAIS ERP`.
- Update `src/routes/vseo-pilot/route.tsx`:
  - Ensure head title uses `VEJAMAIS ERP`.

## 2. Visual & Semantic Breadcrumb
- In `src/routes/vseo-pilot/blog/$slug.tsx`:
  - Add a `<nav aria-label="Breadcrumb">` component with three levels: `VSEO Pilot > Blog Piloto > [Article Title]`.
  - Ensure it's responsive and follows semantic structure (ordered list).
  - Update JSON-LD `BreadcrumbList` to match exactly.

## 3. Editorial Article Structure
- In `src/routes/vseo-pilot/blog/$slug.tsx`:
  - Wrap content in `<article>`.
  - Use `<header>` and `<section>` tags.
  - Apply editorial styling (max-width 720-800px, line-height 1.65-1.8, spacing between sections).
  - Ensure `h2` and `h3` have proper hierarchy.

## 4. Specific Invalid Slug State
- Create `src/routes/vseo-pilot/blog/not-found.tsx` or handle it in `$slug.tsx` error/notFound boundary.
- Implement specific "Artigo não encontrado" page with:
  - "O conteúdo piloto solicitado não existe ou não está disponível."
  - Button "Voltar ao Blog Piloto" pointing to `/vseo-pilot/blog`.
  - Preserve Pilot layout, isolation banner, and robots meta tags.

## 5. Terminology Refinements
- In `src/routes/vseo-pilot/route.tsx`:
  - Change "Blog Mocks" to "Blog Piloto".
- In `src/routes/vseo-pilot/index.tsx`:
  - Change "Meta keywords detectadas (inúteis para Google)" to "Palavra-chave foco interna — não enviada ao Google".

## 6. Placeholder Harmonization
- Update `src/routes/vseo-pilot/blog/index.tsx`:
  - Refine placeholder images to look like deliberate editorial elements (soft backgrounds, simple graphics).

## 7. Compliance Testing
- Update/Add tests in `src/routes/__tests__/vseo-pilot-compliance.test.ts` to reach 45+ real tests covering:
  - Brand normalization (no standalone VEJAMAIS, no double ERP).
  - Breadcrumb semantics and levels.
  - Article semantic structure.
  - Invalid slug state content and behavior.
  - Meta keyword notice update.
  - robots directives preservation.

## Technical Requirements
- Branch: `feature/vseo-mock-pilot-v1-1`
- No SQL, No Database, No main changes.
- Isolated Preview validation.
