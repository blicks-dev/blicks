## Description

Buttons is a container that lays out one or more Button blocks in a row or column with shared alignment, spacing, and wrapping. Only Button blocks can be placed inside it.

## Controls

`orientation`, `gap`, `justify` and `wrap` mirror the `layout.flexDirection`, `layout.gapRow`/`layout.gapColumn`, `layout.justifyContent` and `layout.flexWrap` style values. When a style value is set, it wins on the page and Settings shows it; when it is not, the attribute is the default. Write the style value — Settings keeps the attribute in step.

For a grid of equal columns, set `layout.display: grid` and `layout.gridColumns` (`repeat(3, minmax(0, 1fr))`; Settings writes `repeat(2, …)` at `mobile` for two across on phones). Side by side or Stacked clears both.

### orientation

Arranges the buttons horizontally (a row) or vertically (a column).

### gap

Sets the space between buttons: **None**, **Small**, **Medium** or **Large**, from the spacing scale. Buttons saved with the older **Tight** step keep it.

### justify

Distributes the buttons along the main axis: start, center, end, or space-between.

### wrap

Allows buttons to wrap onto multiple lines when they run out of room, or keeps them on a single line.

## Tips

- Use a horizontal row with a Start or Center distribution for a typical primary/secondary action pair.
- Switch to vertical orientation for stacked calls-to-action on narrow layouts.
- Pair one default (primary) Button with an outline or ghost Button for a clear visual hierarchy.
