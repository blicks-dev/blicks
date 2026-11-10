## Description

Icon renders a small inline SVG from the Blicks icon registry. Use it for visual emphasis, feature markers, compact labels, and UI affordances.

## Controls

### icon

Chooses the icon glyph.

### size

Sets the icon size.

### strokeWidth

Controls the line weight for stroke-based icons.

### filled

Fills the shape with the icon color (`bl-icon--filled`). Suits closed shapes such as stars, hearts and circles; open line icons lose their inner detail.

### label

Adds an accessible label. Leave it empty when the icon is decorative. A linked icon always needs one.

### flipH, flipV, turn

Mirror the drawing left to right or top to bottom, and turn it by a quarter (90, 180 or 270 degrees).

### url, linkTarget, rel

Make the icon a link, optionally opening in a new tab.

## Tips

- Pair decorative icons with nearby text instead of relying on the icon alone.
- Add a label when the icon communicates meaning by itself.
- Use text color controls to make icons follow the design system.
