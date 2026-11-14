# Project Guidelines

## UI Quality Requirements

### Visual design

- Never use text colours that have insufficient contrast against their background.
- Keep all text readable, including placeholders, helper text, disabled states, labels, and error messages.
- Explicitly define foreground, background, border, placeholder, and focus styles for form controls; do not rely on browser defaults.
- Use the project's existing design tokens and theme variables rather than arbitrary colours.
- Ensure components work on both light and dark backgrounds.

### Accessibility

- Meet WCAG 2.2 AA contrast requirements: at least 4.5:1 for normal text and 3:1 for large text.
- Give interactive controls visible focus states.
- Never communicate status using colour alone.

## UI color and contrast

- Never use black or dark text on a black or dark background, or white/light text on a white or light background. Check every component, including dialogs, nested panels, labels, placeholders, inputs, selects, options, radio buttons, disabled states, and status messages.
- For this app's yellow-and-black palette, use high-contrast light text on dark surfaces and dark text on yellow or white surfaces. Use yellow for emphasis and focus states, not as a substitute for readable body text.
- Scope foreground/background rules to their component and interaction state. Avoid broad utility-class overrides that unintentionally recolor nested controls or dialog content.
- When changing UI colors, verify the rendered foreground and background together in a browser test or screenshot, including placeholder and disabled-control states. Do not consider a color fix complete based only on the stylesheet.

## Mandatory UI Verification

Whenever creating or modifying frontend UI:

1. Identify every foreground/background colour combination.
2. Verify text contrast meets WCAG AA.
3. Check placeholder text separately from normal text.
4. Check inputs, textareas, buttons, dropdowns, and disabled states.
5. Test both light and dark themes where supported.
6. Check empty, loading, error, and populated states.
7. Run the project's lint and test commands, including Playwright accessibility tests.
8. Fix all newly introduced accessibility violations before finishing.

Do not consider a UI task complete just because the application builds. A successful build does not prove the UI is visually correct. Do not claim accessibility compliance without running the relevant checks.
