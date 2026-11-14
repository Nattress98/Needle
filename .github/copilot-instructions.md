# Project Guidelines

## UI color and contrast

- Never use black or dark text on a black or dark background, or white/light text on a white or light background. Check every component, including dialogs, nested panels, labels, placeholders, inputs, selects, options, radio buttons, disabled states, and status messages.
- For this app's yellow-and-black palette, use high-contrast light text on dark surfaces and dark text on yellow or white surfaces. Use yellow for emphasis and focus states, not as a substitute for readable body text.
- Scope foreground/background rules to their component and interaction state. Avoid broad utility-class overrides that unintentionally recolor nested controls or dialog content.
- When changing UI colors, verify the rendered foreground and background together in a browser test or screenshot, including placeholder and disabled-control states. Do not consider a color fix complete based only on the stylesheet.
