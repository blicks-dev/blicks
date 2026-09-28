## Description

Scene is a fixed-size stage. Its items are placed at explicit coordinates instead of flowing one after another, so they can overlap, sit at any angle, and animate independently. Use it for hero bands, title cards, and any composition where the arrangement is the design.

A scene is authored once, at its design size, and the whole stage scales to fit the width it is given. That is why there are no per-device positions to maintain: the composition holds together at every screen width because everything in it — type, spacing, shadows — scales together.

## Controls

### Shape

Picks a design size, which is the coordinate space items are placed in. It sets the stage's proportions, not how large it renders.

### Design width

The stage's width in design pixels. An item at x 120 sits 120 of these from the left edge, whatever the screen is actually doing.

### Design height

The stage's height in design pixels. It also fixes the band's aspect ratio, so the page reserves the right amount of room for it.

### Beyond design width

Cap, the default, renders the scene at exactly its design width and centres it, so the design size is a real width. Fill instead keeps enlarging the stage on monitors wider than that, for a band that should run edge to edge.

Either way the scene shrinks proportionally once the screen is narrower than the design width.

## Tips

- Set the design size first. Moving it afterwards rescales where every item already sits.
- Only Scene text and Scene image can go inside a scene — an ordinary block has no way to be placed on the stage.
- Give each item its own animation delay to stagger a composition into view.
- A scene clips anything dragged past its edge, so an item that disappears has been moved off the stage rather than lost.
- Design width is the coordinate space items are placed in, not only a rendered size. Switching to Fill keeps those coordinates and just scales the stage past them.
