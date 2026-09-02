## Description

Section is the full-bleed page band. It renders a fixed semantic `<section>` for background, surface, spacing, and block styling, plus an inner content wrapper whose width, min width, and max width are controlled directly.

## Controls

### sectionWidth

Sets the outer section width. Keep `auto` for normal WordPress full-width alignment behavior, or use a CSS length when the section itself needs a specific width.

### sectionHeight

Sets the outer section minimum height. Keep `auto` for content-driven height, or use values like `80vh`, `600px`, or `100svh` for viewport-based bands without clipping wrapped content.

### contentWidth

Sets the inner content wrapper width.

### contentMinWidth

Sets the inner content wrapper minimum width.

### contentMaxWidth

Sets the inner content wrapper maximum width. The default follows `var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))` so the section stays aligned with the active design system or the active WordPress theme layout.

### surface

Applies a preset treatment to the full-bleed outer section. Use `plain` for invisible structure, `muted` for soft bands, `card` for elevated panels, and `outline` for bordered groups.

### sectionSpace

Applies vertical padding to the outer section. Use it for page rhythm before reaching for manual spacing controls.

## Tips

- Prefer Section for root-level page bands and major layout areas.
- Put Stack or Grid inside Section for content layout.
- The outer section owns the background; the inner wrapper owns content sizing.
