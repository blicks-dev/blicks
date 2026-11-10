# Header Studio

A Pro header builder with mega menus, built here under the module rules (`modules/README.md`) and
moved to Blicks Pro at the v2 release. Built and loaded only with
`BLICKS_DEV_MODULES=header-studio`.

Phases 3 to 7 are here: the blocks, the header mode in the Studio, headers kept as template parts
with their entry points, patterns and agent tools, and a hardening pass across block themes.

## Where a header lives

A header is a block theme **template part in the `header` area**. It is opened in the Studio by ref
(`studio.openRef( 'header', { kind: 'template-part', id: 'theme//slug' } )`) and saved back through
the free plugin's entity route, which writes a theme's own part as the site's customised copy, as
the Site Editor does. A part that is not a Header Studio header yet (the theme's own) opens converted:
its logo, title, menu (its Navigation menu, or the fallback the theme shows) and buttons in a Classic
header. Nothing is written until **Save header**. Around a Header block, core's
`<header class="wp-block-template-part">` wrapper is rendered as a `<div>` (full width if the theme
placed it wide), so the page has one banner landmark.

Ways in:

- **Site Editor**: *Edit in Header Studio* in the block toolbar of a header part, or of a template's
  Template Part block for one.
- **Blicks › Headers**: every header part, whether it is a Header Studio header, the templates that use
  it, and Edit; *New header* opens the Studio's library in the Site Editor.
- **The Studio**: *+ New › Header* (Classic, Centred, Stacked, or from the theme's header), and a
  Header block in a post opens in the header mode too, going back into the post.
- **Header patterns**: the three starters, for the Site Editor's header design picker (`patterns/`).
- **Agents** (Blicks MCP server): `blicks-pro/list-headers`, `blicks-pro/create-header`, and header
  parts open to the free layout tools by their post id.

## The header mode (`resources/studio/`)

The canvas draws the header over a sketched page at wide, tablet and phone widths; where the header
uses its drawer at that width, the phone form is drawn with the drawer open, and On phones Hide and
Last show. Layers names rows, areas, the menu and its mega menus. The **Header** tab sets layout, top
bar, row height, scrolling and phones; the **Item** tab sets the selected menu item, row or element,
and a mega menu: *Edit panel* opens it in a focus scope, *Start over from* swaps its layout, and
*Fill from a WordPress menu* makes its columns Link lists.

## The blocks

| Block | Saves | Holds |
|---|---|---|
| `blicks/header` | `<header class="bl-header …">` with its options as classes: `--sticky`, `--shrink`, `--over`, `--hide`, `--accordion`, `--drawer-<mobile\|always\|never>` | Header rows |
| `blicks/header-row` | `<div class="bl-header-row bl-header-row--<preset>">` | Its three areas, locked |
| `blicks/header-area` | `<div class="bl-header-area bl-header-area--<slot>">` | Logo, menu, buttons, text, search… |
| `blicks/nav` | `<nav aria-label><ul class="bl-nav__list">` | Menu items |
| `blicks/nav-item` | `<li>` with `<a class="bl-nav-item__link">`, or with a mega menu `<button class="bl-nav-item__toggle" aria-expanded="false">` | An optional mega menu |
| `blicks/mega-panel` | `<div class="bl-mega-panel …">`: `--on-click`, `--w-<full\|content>`, `--m-<slide\|none>`, `--scroll-closes` | Box, Heading, Text, Image, Button(s), Loop, Menu link, Link list |
| `blicks/link-list` | nothing (dynamic) | Links from a WordPress menu or chosen pages |

`blicks/menu-link` is in the free plugin; the mega menu only uses it.

Each block's inspector is the v2 one (Settings, Style, More), drawn with the free plugin's kit
(`window.blicks.ui.v2`). Style is a way into Header Studio, whose design panel holds every style
setting for the selected block; in the Studio the design panel takes its place. Nothing in the bar
adds blocks: the Header tab's *Add to a row* tiles, the Item tab's *Add* and a menu's *Add a menu
item* do, so selecting never changes the layout.

Goldens: `tests/__golden__/`. The spec shapes (`src/Ai.php`) are held to the real `save()` by
`tests/fixtures/shape-cases.json`, recorded by `tests/blocks.test.tsx` and replayed by
`tests/Unit/ShapesTest.php`.

## At render (`src/Render.php`)

Nothing that makes the header work is saved; it is written when the page renders, so it can change
without a migration.

- **The drawer is a `blicks/dialog`** in its drawer kind, written after the menu's list and rendered
  through `render_block()` like any Dialog block. A menu button opens it with `commandfor` /
  `command="show-modal"`, and the free `portal` behaviour moves the list into it while it is open
  and back on close. So wide screens have only the navigation and its list in the accessibility
  tree, no dialog. Focus trap, Esc, scroll lock and focus return are the dialog's. Without the
  script the button stays hidden and narrow screens show the list in place, stacked.
- **Breakpoint:** the design system's tablet breakpoint (782px) by default; the header can pick
  phones only (600px), every screen or never.
- **Mega menus** follow the WAI-ARIA disclosure navigation pattern, never the `menu` role: the
  button gets `aria-controls`, the panel an id, the item the free `disclosure` behaviour, and
  `hover-intent` when the panel opens on hover. Esc closes and returns focus; focus leaving or a
  click outside closes; hover counts only for a mouse, so touch opens a panel only from its button.
  In the drawer a panel is a next screen (Back, then its name) or expands in place.
- **Scroll:** a shrinking, see-through or hiding header gets the `sticky-shrink` behaviour; a hiding
  one also gets `data-bl-hide`, and slides up out of view while the page scrolls down (not while
  focus is in it or its drawer is open, and not under reduced motion).

## On phones

Every header block but the Link list has **On phones: Show, Last or Hide**, written with what
the free plugin already has: Hide is the block's mobile visibility (`bl-hide-mobile`), Last a mobile
`flexChild.order` of 99. No new engine control.

## Tests

```bash
pnpm vitest run modules/header-studio                 # goldens and shape cases
vendor/bin/phpunit --testsuite Modules                # shapes
pnpm test:integration --filter HeaderStudio           # render, headers, agents, with wp-env
node modules/header-studio/tests/e2e/hardening.mjs <url>  # four block themes, three widths, axe, RTL
```
