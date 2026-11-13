## Description

Loop repeats the blocks inside it, the card, once for every item in a list: pasted JSON, a data endpoint an administrator added, or a WordPress query. Design the card once; the Loop draws one per item, in a grid, a bento or a list.

In the editor the first card is the live one you edit, and the others preview the next items. A Heading, Text, Image, Button or Box badge inside the card can show a field of each item: choose it under **Data › comes from**, format it under **Format** (case, shorten, number, currency, date, join a list), and wrap it in **Text before** and **Text after**.

Values from JSON and endpoints are always shown as text, never as markup, and links must be `http`, `https` or a path on your site.

## Where the items come from

- **JSON**: a short list you type or paste, up to 256 KB. If it holds several lists, **path** picks one.
- **Endpoint**: a list from an API. Administrators add endpoints under **Blicks › Settings › Data sources**; authors pick one by name, and the Loop stores only its id. Visitors always get a cached answer, refreshed in the background.
- **WordPress**: your own published posts, pages or products, or the page's own query on an archive.

## Controls

### source

Where the items come from: `json`, `endpoint` or `query`.

### data

The pasted JSON, for the JSON source.

### path

Which list to loop over when the JSON or the endpoint's answer holds more than one.

### endpoint

The id of the data endpoint to read, for the Endpoint source. The address itself stays in the site's settings, never in the post.

### query

The post type, order and filters for the WordPress source.

### limit

How many items to show, up to 50. With **pagination** on, every item is shown, a page at a time.

### offset

How many items to skip from the start.

### sort

Sort JSON and endpoint items by one of their fields.

### filter

Keep only the items where one field matches.

### layout

`Grid` sets columns per device in **columns**. `Bento` repeats a pattern of tiles (1 × 1, 2 × 1, 1 × 2, 2 × 2) at a row height, set in **bento**. `List` shows one card per row.

### gap

The space between cards: small, medium or large.

### equalHeights

**Same height in a row** keeps a row's cards level when their text runs to different lengths.

### rules

**Card rules** change a card when its item or position matches: a larger tile, the Highlight style, a different badge color, or a block hidden for some items. Rules run top to bottom, and the lower one wins when two change the same thing.

### emptyText

The message visitors see when there are no items. Left blank, the Loop shows nothing.

### pagination

Split the items into pages: **Numbers** (page links with Previous and Next) or **Load more** (a count and a button, optionally also loading as the visitor scrolls). Each page has its own address, `?loop-<id>=<page>`, so it can be bookmarked or shared.

## Tips

- Start from **Choose a card for this Loop**: every design there is drawn with your first item, and its blocks are connected to fields with matching names.
- Use an endpoint only for a public or read-only feed: endpoints cannot send sign-in headers.
- Size and surface (width, padding, fill, corners, shadow) are in the Style tab, as on a Box.
