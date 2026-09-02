## Description

Stack arranges child blocks in one direction. Use it for vertical content groups, horizontal action rows, navigation groups, and simple card internals where items need predictable spacing.

## Controls

### orientation

Sets the main axis. `Vertical` stacks children top to bottom; `Horizontal` places children in a row.

### tag

Chooses the wrapper element. Use `div` for generic layout, `section` for meaningful groups, `nav` for navigation, and `ul` when the children form a list.

### gap

Sets the spacing between children using Blicks spacing tokens.

### align

Controls cross-axis alignment. In a vertical stack it affects horizontal child alignment; in a horizontal stack it affects vertical alignment.

### justify

Controls main-axis distribution. Use it when the stack has extra space and children need to group, spread, or center.

### wrap

Allows horizontal stacks to wrap onto multiple lines when space gets tight.

## Tips

- Use Stack inside cards, heroes, headers, and form-like groups.
- Use horizontal Stack for buttons and compact metadata rows.
- Use Grid instead when children need columns, rows, or equal-width tracks.
