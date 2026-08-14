# Plan: Evolution of Registration Page for E-commerce Positioning

This plan implements the "Vejamais Ecommerce Registration Guidance" features in the preview environment, focusing on enhancing the registration flow for businesses selling in marketplaces.

## User Review Required

> [!IMPORTANT]
> The marketplace brand references (Mercado Livre, Amazon, etc.) are implemented using neutral typographic chips as specified in the protocol, since official high-resolution assets were not provided. These serve as visual context for e-commerce sellers without suggesting official integration.

## Proposed Changes

### UI & Layout (src/routes/cadastro.tsx)

- **Help Modal ("How it works")**:
    - Add a discrete help button next to the "Criar minha empresa" title.
    - Implement a responsive and accessible `Dialog` modal with the official content:
        - Introduction to centralized commercial and financial management.
        - 4-step guide (Registration, Trial, Organization, Monitoring).
        - Detailed list of benefits.
        - "Entendi, continuar cadastro" CTA that closes the modal.
- **E-commerce Positioning**:
    - Add the heading "Gestão comercial e financeira para e-commerce e comércio" above the form.
    - Add the subtext highlighting organization of sales results from marketplaces and virtual stores.
- **Marketplace Visual Ecosystem**:
    - **Desktop**: Create a visual composition around the form using neutral cards for Mercado Livre, Shopee, Amazon, Magalu, Mercado Pago, Temu, and SHEIN.
    - **Mobile**: Display the marketplace references in a grid/carousel layout below the form.
    - Add the mandatory disclaimer regarding brand ownership and the lack of automatic integration/partnership.
- **Responsive Improvements**:
    - Ensure the layout adapts to 1440, 1280, 1024, 768, 430, 390, 360 and 320px viewports without horizontal scrolling.
    - Maintain touch targets at a minimum of 44x44 pixels.

### Technical Details

- **Accessibility**:
    - Modal uses `aria-haspopup="dialog"`, title access, focus trap, and Escape key handling.
    - Decorative marketplace elements use `aria-hidden="true"`.
    - Adheres to `prefers-reduced-motion` and AA contrast standards.
- **Preservation**:
    - Byte-identical preservation of all existing functional logic: CNPJ validation (numeric/alphanumeric), BrazilAPI integration, Turnstile security, terms acceptance, and `empresa_id` propagation.
- **Performance**:
    - No external scripts or heavy libraries added.
    - Typographic chips used instead of remote images to avoid CLS and ensure legitimacy.

## Validation Plan

1. **Static Analysis**: Run `bun run typecheck` and `bun run build`.
2. **Interactive Testing**:
    - Verify modal opening/closing and focus management (keyboard & mouse).
    - Verify CNPJ validation still functions correctly for both formats.
    - Check responsive behavior across all specified breakpoints using the preview device tool.
3. **Audit**:
    - Confirm absence of horizontal scroll.
    - Verify the "FAIL-CLOSED" nature of the existing registration flow is untouched.
    - Ensure the mandatory disclaimer is legible.
