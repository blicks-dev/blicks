## Description

Box is the one block for every surface on a page. Pick what it is — a plain wrapper, a card, a panel, a cover, a badge, a divider or a spacer — and how it arranges what's inside: one under another, side by side, in even columns, or layered on top of each other. Each choice is a starting point that sets ordinary style values, so everything it sets can be changed in the Style tab.

## Controls

### kind

What the box is. Plain has no look of its own; Card, Panel and Cover start from a framed, tinted or full-color look and hold other blocks; Badge holds a short line of text; Divider draws a line; Spacer is empty room. Picking another kind starts its look over. A badge, divider or spacer holds no blocks, so those are offered only while the box is empty.

### blicks

Stores the full Blicks style tree. Arrangement, width, height and "stay on screen" all write into it.

### tag

The element the box is, for search engines and screen readers: a section of the page, a card or post, a side note, navigation and so on. It does not change the look.

### layers

Set by the "On top" arrangement: every child shares one cell, so later ones sit over earlier ones — words over a picture.

### text

The label a badge shows.

### href

Makes the whole box clickable. A container box gets a link stretched over it, with links and buttons inside it still clickable; a badge becomes the link.

## Tips


- Use a Card arranged as a stack inside a Grid box for pricing and feature cards.
- Use Section for page bands, including anything that runs edge to edge (full-bleed); a Box stays within the content width. Put Boxes inside the Section.
- A Cover arranged "On top" puts a heading over a background picture.
