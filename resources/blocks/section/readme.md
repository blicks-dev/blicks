## Description

Section is the full-bleed page band. It renders a fixed semantic `<section>` for background, surface, spacing, and block styling, plus an inner content wrapper whose width, min width, and max width are controlled directly. Its inspector has three tabs: **Settings** (the band and its content width), **Style** (the shared Style panel: fill, border, corners, shadow, space) and **Motion** (entrance, scroll and hover effects).

## Controls

### align

Settings ▸ Band. **Edge to edge** (`full`, the default) runs the band across the whole page; **In the column** sits it in the content column like any other block.

### sectionWidth

Settings ▸ Band ▸ Width. Sets the outer section width. Keep `auto` for normal WordPress full-width alignment behavior, or type a CSS length when the section itself needs a specific width.

### sectionHeight

Settings ▸ Height, at least. Sets the outer section minimum height. Keep `auto` for content-driven height, or use values like `80vh`, `600px`, or `100svh` for viewport-based bands without clipping wrapped content.

### contentWidth

Settings ▸ Content width ▸ Width. Sets the inner content wrapper width.

### contentMinWidth

Settings ▸ Content width ▸ At least. Sets the inner content wrapper minimum width.

### contentMaxWidth

Settings ▸ Content width ▸ At most. Sets the inner content wrapper maximum width. The default, **Theme**, follows `var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))` so the section stays aligned with the active design system or the active WordPress theme layout.

### surface

Settings ▸ Surface. Applies a preset treatment to the full-bleed outer section. Use `plain` for invisible structure, `muted` for soft bands, `card` for elevated panels, and `outline` for bordered groups.

### sectionSpace

Settings ▸ Space above and below. Applies vertical padding to the outer section. Use it for page rhythm before reaching for the Style tab's space controls.

## Tips

- Prefer Section for root-level page bands and major layout areas.
- Put a Box inside Section for content layout; the starting layouts add a stacked Box for you.
- The outer section owns the background; the inner wrapper owns content sizing.
- Every size field takes a CSS length, a keyword such as `auto` or `none`, or a function such as `clamp()` or `var()`.
