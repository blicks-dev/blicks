=== Blicks ===
Contributors: blicks
Tags: blocks, gutenberg, design system, full site editing
Requires at least: 6.6
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

Token values become utility classes. Custom values become CSS custom properties on the element, and per-instance rules — pseudo-elements, container queries, keyframes — are collected into one stylesheet rather than repeated on every block.

**What's included**

* 12 layout and content blocks, all in one Blicks inserter category
* A design system admin screen for editing tokens, type roles, breakpoints, and custom keyframe animations
* Named design themes — save a set of token values, switch between them, or reset back to your theme's defaults
* An HTML importer that turns pasted markup into Blicks blocks, mapping the inline styles it recognises onto block controls
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

No. There is no stylesheet field, no script field, and no snippet runner. Blicks never evaluates anything you type, and you cannot write a CSS rule, a selector, or an at-rule anywhere in it.

Two places do accept typed input, and both are described below.

Some controls take a typed value rather than offering a picker — a length like `800px`, a transform like `translateX(10px)`, a shape like `polygon(0 0, 100% 0, 100% 100%)`. Each of those is the value of one named property that the control itself chooses; you cannot write the property, a selector, or a rule. Every value is validated whole against a closed list of permitted characters and CSS functions before it is used, so a value cannot end its own declaration or start another one. Anything that does not validate is dropped.

The custom animation editor (**Blicks → Design System → Animations**, administrators only) works the same way. Each keyframe step is a form row: you pick a property from a fixed list of animatable properties (opacity, transform, color and similar), and type its value, which is validated exactly as above. You cannot name any other property, write a selector, or add an at-rule; Blicks generates the `@keyframes` rule and its name itself.

= Can I paste in HTML from somewhere else? =

Yes. **Import HTML** in the editor's options (⋮) menu opens a one-way importer: you paste a block of markup, Blicks maps each element to the closest Blicks block, and inserts the result into the post.

It reads each element's inline `style` attribute only — not `<style>` blocks, not stylesheets, not `<script>`. A declaration is kept only where its property matches an existing Blicks control that takes a plain value; it then becomes an ordinary block attribute, validated exactly like any value you would have typed into that control yourself. Everything else — every property with no matching control, and every structured control that would need reshaping — is dropped, and the import report names each one so nothing is silently discarded.

The pasted text itself is never stored and never rendered. No pasted CSS reaches the front end unvalidated, and pasted `<script>` is parsed as text, never executed.

= Does Blicks let me use my own images as backgrounds? =

Yes, via the media library. Background image URLs are restricted to your own site's uploads or an ordinary `http(s)` address; `javascript:` and `data:` URLs are rejected.

== Screenshots ==

1. The Blicks admin: an overview of what is registered, the design system screen where token values are edited, and the presets that repaint the whole set at once.
2. Theme Settings in the editor. The colours, type scale and spacing come from the active theme's theme.json, so they are the same values the front end uses.
3. Block controls, split across three tabs: Settings for what the block is, Style for every property at each breakpoint and state, and Advanced for visibility and custom attributes.

== External Services ==

Blicks uses no external services. It contacts no third-party server, loads no remote fonts, scripts or styles, and sends no data anywhere. Everything it renders is served from the plugin itself and from your own theme's settings.

The only exception is one you control: if you set a background image to an address on another site, the visitor's browser loads that image from wherever you pointed it. Blicks itself makes no such request.

== Source Code ==

The JavaScript and CSS in the `build/` directory are compiled. The full, human-readable source they are built from — TypeScript, SCSS, the block definitions and the build configuration — is public at:

https://github.com/blicks-dev/blicks

To rebuild the plugin from source you need Node.js 20+ and pnpm:

1. `git clone https://github.com/blicks-dev/blicks.git && cd blicks`
2. `pnpm install`
3. `pnpm build` — writes the compiled assets to `build/`.

The PHP in `src/` is shipped as source and is not compiled. Blicks has no production PHP
dependencies and bundles no third-party PHP library — the `vendor/` directory in the release holds
only Composer's own class autoloader. Composer is otherwise used just for the development tools
(PHPUnit, PHP_CodeSniffer), which are never shipped.

== Support and Feedback ==

Bug reports and feature requests are handled in public, on the GitHub issue tracker:

* Report a bug: https://github.com/blicks-dev/blicks/issues/new?template=bug_report.yml
* Request a feature: https://github.com/blicks-dev/blicks/issues/new?template=feature_request.yml
* Questions and how-do-I: https://github.com/blicks-dev/blicks/discussions

Both forms are also linked from the plugin itself — under the Blicks row on the Plugins screen, and at the foot of the Blicks Overview screen.

A bug report is most useful with the WordPress and PHP versions, the active theme, and the block markup copied from the editor (select the block, then Options -> Copy). The form asks for each of these.

Security issues should never be filed as a public issue. Report them privately at https://github.com/blicks-dev/blicks/security/advisories/new.

== Third-Party Licenses ==

Blicks includes a curated icon registry generated from Lucide icons. Lucide is licensed under ISC; some Lucide icons derive from Feather icons, licensed under MIT. Full notices are in `licenses.txt` and in the generated icon registry metadata.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
First public release.
