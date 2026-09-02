## Description

Grid arranges child blocks in columns. Use it for feature cards, pricing cards, galleries, comparison panels, and any layout where multiple items should align in a repeated structure.

## Controls

### columns

Sets the number of equal-width columns when auto-fit is off.

### autoFit

Lets the grid create as many columns as fit the available width. This is useful for responsive card collections.

### minColumnWidth

Sets the minimum column width used by auto-fit grids.

### gap

Sets row and column spacing between grid children using Blicks spacing tokens (XS–XL).

### dense

Allows the browser to pack grid items into earlier empty spaces when possible.

### tag

Chooses the grid wrapper element. Use `div` for generic layout and `ul`/`ol` when the children form a list. For a full-width band, wrap the Grid in a Section block instead of changing the tag.

## Tips

- Use Grid for repeated sibling items, then use Stack inside each item for card content.
- Use two columns for pricing and comparison sections.
- Use auto-fit for collections that should adapt without manual breakpoint changes.
