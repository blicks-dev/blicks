=== Blicks ===
Contributors: blicks
Tags: blocks, gutenberg, design system, full site editing
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Gutenberg blocks that use your theme's design system.

== Description ==

Blicks adds a set of blocks for building page layouts in the block editor — sections, boxes, stacks, grids, headings, text, buttons, images, icons, spacers, and dividers.

All blocks share one design system. Instead of a fixed colour or font size baked into each block, Blicks reads your active theme's `theme.json` and uses those settings in the block controls and in the front-end CSS. Change a value once and it applies everywhere.

**Works with your theme**

Blicks tokens (`--blicks-*`) map to WordPress preset variables (`--wp--preset--*`, `--wp--custom--*`). Colours, type scale, and spacing come from whatever theme is active, not a separate default set. Built for block themes and full site editing.

**Output**

Token values become utility classes. Custom values become scoped CSS variables instead of inline styles.

**What's included**

* 12 layout and content blocks, all in one Blicks inserter category
* A design system admin screen for editing tokens, type roles, breakpoints, and custom keyframe animations
* Named design themes — save a set of token values, switch between them, or reset back to your theme's defaults
* No jQuery and no bundled front-end framework — blocks render as plain HTML and CSS

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/blicks/`, or install it through the WordPress Plugins screen.
2. Activate Blicks from the Plugins screen.
3. Open the block editor and insert blocks from the Blicks category.
4. Optional: visit **Blicks → Design System** to adjust tokens, type roles, and breakpoints.

== Frequently Asked Questions ==

= Does Blicks work with my theme? =

It's built for block themes and full site editing, where it reads your `theme.json` directly. It also runs on classic themes, but falls back to its own default token values since there's no `theme.json` to read.

= What happens to my data if I delete the plugin? =

By default, nothing is removed — your tokens, themes, animations, and settings survive a delete and reinstall. If you want Blicks to clean up after itself, set **On uninstall** to "Delete all Blicks data" in **Blicks → Settings** before deleting the plugin.

= Can I add my own CSS, JavaScript, or PHP through Blicks? =

No. There is no stylesheet field, no script field, and no snippet runner. Blicks does not accept CSS rules, selectors, or code of any kind, and it never evaluates anything you type.

Some controls do take a typed value rather than offering a picker — a length like `800px`, a transform like `translateX(10px)`, a shape like `polygon(0 0, 100% 0, 100% 100%)`. Each of those is the value of one named property that the control itself chooses; you cannot write the property, a selector, or a rule. Every value is validated whole against a closed list of permitted characters and CSS functions before it is used, so a value cannot end its own declaration or start another one. Anything that does not validate is dropped.

= Does Blicks let me use my own images as backgrounds? =

Yes, via the media library. Background image URLs are restricted to your own site's uploads or an ordinary `http(s)` address; `javascript:` and `data:` URLs are rejected.

== External Services ==

Blicks uses no external services. It contacts no third-party server, loads no remote fonts, scripts or styles, and sends no data anywhere. Everything it renders is served from the plugin itself and from your own theme's settings.

The only exception is one you control: if you set a background image to an address on another site, the visitor's browser loads that image from wherever you pointed it. Blicks itself makes no such request.

== Third-Party Licenses ==

Blicks includes a curated icon registry generated from Lucide icons. Lucide is licensed under ISC; some Lucide icons derive from Feather icons, licensed under MIT. Full notices are in `licenses.txt` and in the generated icon registry metadata.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
First public release.
