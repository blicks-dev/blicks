=== Blicks - Layout Blocks for the Block Editor ===
Contributors: blicks
Tags: gutenberg, blocks, block editor, layout, design system
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.1
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Layout and content blocks for the block editor, with hover, breakpoint and pseudo-element controls on a design system that syncs with theme.json.

== Description ==

= ATOMIC LAYOUT AND CONTENT BLOCKS FOR THE WORDPRESS BLOCK EDITOR, ON ONE DESIGN SYSTEM THAT SYNCS WITH YOUR THEME.JSON =

Blicks adds composable layout and content blocks to the native block editor — Section, Box, Stack, Grid, Heading, Text, Buttons, Button, Image, Icon, Spacer and Divider.

Every block draws from one design system. Instead of a color or a font size baked into each block, Blicks keeps a token catalogue whose values resolve through your active theme's `theme.json` presets. Set a value once and it applies everywhere, and where your theme defines no scale of its own, Blicks falls back to its own.

Blicks is free and GPL-2.0-or-later. It contacts no external server, ships no license key, and adds no telemetry.

### 🧱 The blocks

- **Section**: A full-bleed page band with outer section sizing and independent content sizing controls.
- **Box**: A generic styled wrapper for cards, panels, and manual layouts.
- **Stack**: A one-dimensional flex layout for arranging child blocks vertically or horizontally.
- **Grid**: A two-dimensional layout block for equal-width or auto-fit child columns.
- **Heading**: A semantic h1–h6 heading that inherits the active theme by default.
- **Text**: A rich paragraph block for body copy.
- **Buttons** and **Button**: A row or column of buttons with shared alignment, spacing and wrapping, each with variants, sizes, links and optional icons.
- **Image**: A responsive media block with optional link and caption.
- **Icon**: An inline SVG icon that inherits the current text color.
- **Spacer**: A responsive empty space block for vertical or horizontal rhythm.
- **Divider**: A semantic divider for separating content groups.

All of them live in one Blicks category in the inserter.

= 🎨 Key features =

- **Theme-native tokens**: Blicks tokens (`--blicks-*`) alias WordPress preset variables (`--wp--preset--*`, `--wp--custom--*`), so color, type and spacing values resolve through whatever theme is active.
- **Type roles**: Semantic typography roles — display, h1–h6, body, lead, small, caption, code, mono — layered on top of the font-size scale, so a heading is styled by the role it plays.
- **Named design themes**: Snapshot a set of token values, switch between them, or reset back to your theme's defaults.
- **Responsive design**: Every style value can be set per device — desktop, tablet and mobile — with tablet and mobile breakpoints you control.
- **States**: Every style value can also be set per state — default, hover, focus and active.
- **Pseudo-elements**: Style `::before` and `::after` as boxes in their own right, from the same controls.
- **Custom keyframe animations**: Build animations step by step in the admin, then apply them from the block's Animation controls. Animated rules are wrapped in `prefers-reduced-motion: no-preference`.
- **Container queries**: Set a container type and name on a block, and size its children against the container rather than the viewport.
- **Visibility and attributes**: Hide a block at chosen screen sizes, and add `data-*`, `aria-*`, `role`, `title`, `id`, `lang` or `dir` attributes to its wrapper.
- **HTML importer**: Paste markup and Blicks maps each element to the closest block, turning the inline styles it recognizes into ordinary block attributes.

= 🎛️ Style controls on every block =

Block controls are split across three tabs — Settings for what the block is, Style for how it looks, Advanced for visibility and attributes. The Style tab covers:

- **Layout**: display, flex direction and alignment, grid tracks and areas, gap, width and height bounds, overflow, scroll snap, container queries, aspect ratio, object fit.
- **Spacing**: padding and margin, per side.
- **Typography**: type role, family, size, line height, weight, style, letter and word spacing, transform, decoration, alignment, writing mode, text color.
- **Background**: color, gradient, image, size, position, repeat, attachment, blend mode, background-clip text.
- **Border**: width, style, color and radius.
- **Position**, **Multi-column**, **Grid child**, **Flex child**, **Effects**, **Animation**, **Pseudo-elements** and **States**.

= ⚡ Output =

- **One stylesheet, 13 KB gzipped**: The runtime stylesheet is 13,301 bytes gzipped, and it is the only stylesheet Blicks enqueues.
- **No per-block style tags**: Token values become utility classes; custom values become CSS custom properties on the element.
- **Per-instance rules collected once**: Pseudo-elements, container queries and keyframes are accumulated, deduplicated and attached once per request rather than repeated on every block.
- **Plain HTML and CSS**: No jQuery, no bundled front-end framework, no shortcodes.

= 🧰 The Blicks admin =

Three screens under the **Blicks** menu:

- **Overview**: What is registered, and links to the docs and the issue forms.
- **Design System**: Token values by category — color, typography, spacing, radius, shadow, gradient, motion, animation, z-index, opacity, border, focus ring, sizing, line height — plus breakpoints, type roles, named themes and the custom animation editor.
- **Settings**: Plugin behavior, including whether Blicks removes its data on uninstall.

= 🔒 No external services =

Blicks contacts no third-party server. It loads no remote fonts, scripts or styles, and sends no data anywhere. Everything it renders is served from the plugin itself and from your own theme's settings.

= 🌐 Translation =

Blicks is fully internationalized and ships a `.pot` file. To contribute a translation, add a language via [translate.wordpress.org](https://translate.wordpress.org/projects/wp-plugins/blicks).

= 🧑‍💻 Open source =

The full source — TypeScript, SCSS, block definitions and build configuration — is public at [github.com/blicks-dev/blicks](https://github.com/blicks-dev/blicks), and the documentation is generated from it at [docs.blicks.dev](https://docs.blicks.dev).

= 💬 Support, feedback and security =

Bug reports and feature requests are handled in public, on the GitHub issue tracker:

- [Report a bug](https://github.com/blicks-dev/blicks/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/blicks-dev/blicks/issues/new?template=feature_request.yml)
- [Questions and how-do-I](https://github.com/blicks-dev/blicks/discussions)

Both forms are linked from the plugin itself — under the Blicks row on the Plugins screen, and at the foot of the Blicks Overview screen. A bug report is most useful with the WordPress and PHP versions, the active theme, and the block markup copied from the editor (select the block, then Options → Copy). The form asks for each of these.

Security issues should never be filed as a public issue. Report them privately at [github.com/blicks-dev/blicks/security/advisories/new](https://github.com/blicks-dev/blicks/security/advisories/new).

== Installation ==

= Minimum Requirements =

* WordPress 6.6 or greater
* PHP version 8.1 or greater
* A block theme with a `theme.json`, to get token values from your theme

= Recommended Requirements =

* WordPress 7.0 or greater
* PHP version 8.3 or greater

**Note:** Blicks runs on classic themes too, but falls back to its own default token values, since there is no `theme.json` to sync with.

= Installation =

1. Install using the WordPress built-in plugin installer, or extract the zip file and drop the contents in the `wp-content/plugins/` directory of your WordPress installation.
2. Activate Blicks through the 'Plugins' menu in WordPress.
3. Go to Pages → Add New.
4. Open the inserter and pick a block from the **Blicks** category.
5. Optional: visit **Blicks → Design System** to adjust tokens, type roles and breakpoints.

For guides and the generated block reference, visit [docs.blicks.dev](https://docs.blicks.dev).

== Frequently Asked Questions ==

= Is this a page builder? =

No. Blicks lives inside the native block editor and adds layout primitives — Stack, Grid, Box, Section — that you compose the same way you compose any other block. Nothing replaces your editor.

= Does Blicks work with my theme? =

It is built for block themes and full site editing, where it reads the presets your `theme.json` defines and resolves its own tokens through them. It also runs on classic themes, but falls back to its own default token values, since there is no `theme.json` to sync with.

= Does Blicks replace my theme's design system? =

No. Blicks keeps its own catalogue of token slugs, and their values alias your theme's preset variables where the theme defines them. Where it defines none — a shadow scale, say — Blicks supplies its own, so a control is never empty.

= Will it slow down my site? =

Blicks enqueues one stylesheet, 13,301 bytes gzipped, on requests that render a block. There is no per-block `<style>` tag and no per-request CSS generation for token and utility values. Per-instance rules — pseudo-elements, container queries, keyframes — are collected and deduplicated into a single block in the footer.

= What happens to my content if I deactivate Blicks? =

Blocks save static HTML, so the markup stays in the post. The runtime stylesheet stops loading, so the styling it carries goes with it.

= What happens to my data if I delete the plugin? =

By default, nothing is removed — your tokens, themes, animations and settings survive a delete and reinstall. If you want Blicks to clean up after itself, set **On uninstall** to "Delete all Blicks data" in **Blicks → Settings** before deleting the plugin.

= Can I add my own CSS, JavaScript or PHP through Blicks? =

No. There is no stylesheet field, no script field and no snippet runner. Blicks never evaluates anything you type, and you cannot write a CSS rule, a selector or an at-rule anywhere in it.

Two places do accept typed input. Some controls take a typed value rather than offering a picker — a length like `800px`, a transform like `translateX(10px)`, a shape like `polygon(0 0, 100% 0, 100% 100%)`. Each of those is the value of one named property that the control itself chooses; you cannot write the property, a selector or a rule. Every value is validated whole against a closed list of permitted characters and CSS functions before it is used, so a value cannot end its own declaration or start another one. Anything that does not validate is dropped.

The custom animation editor (**Blicks → Design System → Animations**, administrators only) works the same way. Each keyframe step is a form row: you pick a property from a fixed list of animatable properties (opacity, transform, color and similar), and type its value, which is validated exactly as above. You cannot name any other property, write a selector or add an at-rule; Blicks generates the `@keyframes` rule and its name itself.

= Can I paste in HTML from somewhere else? =

Yes. **Import HTML** in the editor's options (⋮) menu opens a one-way importer: you paste a block of markup, Blicks maps each element to the closest Blicks block, and inserts the result into the post.

It reads each element's inline `style` attribute only — not `<style>` blocks, not stylesheets, not `<script>`. A declaration is kept only where its property matches an existing Blicks control that takes a plain value; it then becomes an ordinary block attribute, validated exactly like any value you would have typed into that control yourself. Everything else — every property with no matching control, and every structured control that would need reshaping — is dropped, and the import report names each one so nothing is silently discarded.

The pasted text itself is never stored and never rendered. No pasted CSS reaches the front end unvalidated, and pasted `<script>` is parsed as text, never executed.

= Can I use my own images as backgrounds? =

Yes, via the media library. Background image URLs are restricted to your own site's uploads or an ordinary `http(s)` address; `javascript:` and `data:` URLs are rejected.

= Does Blicks respect reduced motion? =

Yes. Rules that carry a keyframe animation are emitted inside `@media (prefers-reduced-motion: no-preference)`, so a visitor who has asked for reduced motion never gets them.

= How can I contribute? =

The source is at [github.com/blicks-dev/blicks](https://github.com/blicks-dev/blicks). Issues, pull requests and translations are all welcome; translations go through [translate.wordpress.org](https://translate.wordpress.org/projects/wp-plugins/blicks).

== Screenshots ==

1. **The Blicks admin** - An overview of what is registered, the design system screen where token values are edited, and the presets that repaint the whole set at once.
2. **Theme Settings in the editor** - Colors, type scale and spacing resolved from the active theme's `theme.json`, so they are the same values the front end uses.
3. **Block controls** - Split across three tabs: Settings for what the block is, Style for every property at each breakpoint and state, and Advanced for visibility and custom attributes.

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

The PHP in `src/` is shipped as source and is not compiled. Blicks has no production PHP dependencies and bundles no third-party PHP library — the `vendor/` directory in the release holds only Composer's own class autoloader. Composer is otherwise used just for the development tools (PHPUnit, PHP_CodeSniffer), which are never shipped.

== Third-Party Licenses ==

Blicks includes a curated icon registry generated from Lucide icons. Lucide is licensed under ISC; some Lucide icons derive from Feather icons, licensed under MIT. Full notices are in `licenses.txt` and in the generated icon registry metadata.

== Changelog ==

= 1.0.1 - 2026-09-23 =

* Tweak: Each block now carries its own icon in the block metadata, so the blocks show their marks on the plugin page and under Plugins → Add New → Blocks.
* Tweak: Added Documentation, Report a bug and Request a feature links to the plugin's row on the Plugins screen and to the Blicks Overview screen.
* Fix: Overview screen cards stopped short of the space available to them, and the panels sat flush against each other instead of being evenly spaced.
* Fix: The front-end stylesheet was served from the browser cache after an update that changed only CSS.

= 1.0.0 - 2026-09-17 =

* New: Initial release — Section, Box, Stack, Grid, Heading, Text, Buttons, Button, Image, Icon, Spacer and Divider blocks.
* New: A design system whose tokens resolve through the active theme's `theme.json` presets, with semantic type roles, named design themes and custom keyframe animations.
* New: Style controls that store a value per state (default, hover, focus, active) and per device (desktop, tablet, mobile).
* New: An admin area with Overview, Design System and Settings screens.
* New: An HTML importer that maps pasted markup onto Blicks blocks.

== Upgrade Notice ==

= 1.0.1 =
Adds each block's icon to its metadata, and fixes a stale front-end stylesheet after CSS-only updates.

= 1.0.0 =
First public release.
