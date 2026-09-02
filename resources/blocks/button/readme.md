## Description

Button renders a clickable action. It can output a real button when no URL is set or a link-style button when a URL is provided.

## Controls

### text

The visible button label.

### url

The destination URL. When set, the block renders as an anchor so it can navigate like a link.

### linkTarget

Controls whether the link opens in the same tab or a new tab.

### rel

Sets relationship attributes for link output, such as `nofollow` or `noopener`.

### variant

Chooses the visual style: primary/default, secondary, outline, ghost, destructive, or link.

### size

Chooses the button size preset.

### icon

Adds an optional built-in icon.

### iconPosition

Places the icon before or after the label.

## Tips

- Use one primary button per section when possible.
- Use outline or secondary variants for supporting actions.
- If the button navigates, set a URL; if it triggers an interaction, leave the URL empty.
