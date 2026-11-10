=== Blicks ===
Contributors: blicks
Tags: gutenberg, blocks, block editor, layout, design system
Requires at least: 7.0
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 2.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Layout and content blocks for the block editor, with forms, lists, dialogs and data loops, on a design system that syncs with theme.json.

== Description ==

= ATOMIC LAYOUT AND CONTENT BLOCKS FOR THE WORDPRESS BLOCK EDITOR, ON ONE DESIGN SYSTEM THAT SYNCS WITH YOUR THEME.JSON =

Blicks adds composable layout and content blocks to the native block editor — Section, Box, Heading, Text, Buttons, Image, Icon, List, Steps, Form, Dialog and Loop, among others.

Every block draws from one design system. Instead of a color or a font size baked into each block, Blicks keeps a token catalog whose values resolve through your active theme's `theme.json` presets. Set a value once and it applies everywhere, and where your theme defines no scale of its own, Blicks falls back to its own.

Blicks is free and GPL-2.0-or-later. It ships no license key, adds no telemetry, and contacts no external server unless you turn on a service that needs one (see External Services).

**Upgrading from 1.x?** Blicks 2.0 is a clean break: it does not convert layouts built with 1.x. Read the Upgrade Notice and [docs.blicks.dev/upgrading](https://docs.blicks.dev/upgrading?utm_source=wporg&utm_medium=referral&utm_campaign=evergreen&utm_content=readme-intro-upgrade) before you update a site with Blicks pages on it.

### 🧱 The blocks

- **Section**: A full-width page band with separate sizing for the band and for its content.
- **Box**: One block for every surface — a plain wrapper, card, panel, cover, badge, divider or spacer — that arranges its children stacked, side by side, in a grid or in layers.
- **Heading** and **Text**: Semantic h1–h6 headings and rich paragraphs that follow your type roles.
- **Buttons** and **Button**: A row or column of buttons with shared alignment and spacing, each with variants, sizes, links and optional icons.
- **Image** and **Icon**: A responsive image with an optional link and caption, and an inline SVG icon that inherits the current text color.
- **List** and **List item**: Bulleted, numbered and icon lists you type into, with done, highlighted and left-out items.
- **Steps** and **Step**: Steppers, "how it works" rows and timelines, with a current step.
- **Form**, **Field** and **Input**: Contact and sign-up forms, with entries kept in the admin, email notifications and built-in spam checks.
- **Dialog**: Modals, drawers, bottom sheets and full screens on the browser's own `<dialog>` element, opened by a Button or a link, with Esc, click-outside and focus return built in.
- **Loop**: Repeat one card for every item in pasted JSON, a data endpoint an administrator adds, or a WordPress query, with pages.
- **Menu link**: A link with a description line, an icon and a badge, for menus and link columns.

All of them live in one Blicks category in the inserter.

= 🎛️ The inspector: Settings · Style · Motion =

Every Blicks block has the same sidebar, with three tabs:

- **Settings**: What the block is and does — a Box's kind and arrangement, its size, a link, its meaning for screen readers and search engines.
- **Style**: How it looks, in sections named for the goal — Text, Fill, Border and corners, Shadow and depth, Space and States. **On hover**, **When clicked** and **Keyboard focus** are ready-made looks you can customize.
- **Motion**: Entrance effects as a block scrolls into view, and how fast and with what feel hover and click changes play.

Phone layouts are switches on the block, such as **Stack on phones**. A **More** tab hides a block on desktop, tablet or phone and adds screen-reader text and HTML attributes. **All settings**, at the foot of the Style tab, lists every value a block stores and lets you add any setting the block allows.

= 🎨 Key features =

- **Theme-native tokens**: Blicks tokens (`--blicks-*`) alias WordPress preset variables (`--wp--preset--*`, `--wp--custom--*`), so color, type and spacing values resolve through whatever theme is active.
- **Type roles**: Semantic typography roles — display, h1–h6, body, lead, small, caption, code, mono — layered on top of the font-size scale, so a heading is styled by the role it plays.
- **Design system screen**: Pick a design language and a palette, change any token with your site previewed live beside it, save kits, and add your own tokens and keyframe animations.
- **Blicks Studio**: A full-screen workspace for composing a section from the pattern library, with layers, desktop, tablet and phone widths, and a Play button for motion. Nothing is written to your post until you insert it.
- **Forms with entries**: Visitors' sends are stored under **Blicks → Entries**, where you can filter, read and export them. Every form runs a hidden trap field, a minimum wait, a signed single-use token, a same-site check and a rate limit; reCAPTCHA or Turnstile can be added per form.
- **Data loops**: A Loop shows pasted JSON, a WordPress query, or a JSON endpoint that an administrator adds under **Blicks → Settings → Data sources**. Values are always shown as text, never as markup, and visitors never wait on the API: answers are cached and refreshed in the background.
- **Reduced motion respected**: Rules that carry a keyframe animation are emitted inside `prefers-reduced-motion: no-preference`.
- **HTML importer**: Paste markup and Blicks maps each element to the closest block, turning the inline styles it recognizes into ordinary block attributes.

= 🤖 AI abilities and MCP =

Blicks registers its abilities with the WordPress Abilities API and serves them as an MCP (Model Context Protocol) server, so an AI agent — Claude Code, Claude Desktop, Cursor, Codex — can list the blocks, read the design system, check a layout, read a page, create a draft and replace a page's blocks. It is off until an administrator turns it on under **Blicks → MCP**; while it is off, no ability and no server is registered.

= ⚡ Output =

- **No per-block style tags**: Token values become utility classes; custom values become CSS custom properties on the element.
- **Per-instance rules collected once**: Pseudo-elements, container queries and keyframes are accumulated, deduplicated and attached once per request rather than repeated on every block.
- **Plain HTML and CSS**: Blocks save static HTML, except Section, Form, Field, Input and Loop, which render on the server from the attributes they save. No jQuery, no shortcodes.

= 🧰 The Blicks admin =

Five screens under the **Blicks** menu:

- **Overview**: A getting-started checklist, a preview of your design system, recent changes and health checks.
- **Design System**: Colors, typography, spacing, corners, shadows, motion and the rest, with your site previewed live beside them.
- **Settings**: Global Styles sync, the Marketplace switch, Loop data sources, form spam-check keys, and what happens to your data when Blicks is deleted.
- **MCP**: Turn on AI agent access and connect a client. Off until you turn it on.
- **Entries**: What visitors sent through your forms.

= 🔒 No external services by default =

Out of the box, Blicks contacts no third-party server. It loads no remote fonts, scripts or styles, and sends no data anywhere. Everything it renders is served from the plugin itself and from your own theme's settings. The only remote services are ones an administrator opts into: a spam check on a form, a data endpoint for a Loop, or the Marketplace shelf in the Studio library. Each is listed under External Services, with exactly what it sends and when.

= 🌐 Translation =

Blicks is fully internationalized and ships a `.pot` file. To contribute a translation, add a language via [translate.wordpress.org](https://translate.wordpress.org/projects/wp-plugins/blicks).

= 🧑‍💻 Open source =

The full source — TypeScript, SCSS, block definitions and build configuration — is public at [github.com/blicks-dev/blicks](https://github.com/blicks-dev/blicks), and the documentation is generated from it at [docs.blicks.dev](https://docs.blicks.dev/?utm_source=wporg&utm_medium=referral&utm_campaign=evergreen&utm_content=readme-open-source).

= 💬 Support, feedback and security =

Bug reports and feature requests are handled in public, on the GitHub issue tracker:

- [Report a bug](https://github.com/blicks-dev/blicks/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/blicks-dev/blicks/issues/new?template=feature_request.yml)
- [Questions and how-do-I](https://github.com/blicks-dev/blicks/discussions)

Both forms are linked from the plugin itself — under the Blicks row on the Plugins screen, and at the foot of the Blicks Overview screen. A bug report is most useful with the WordPress and PHP versions, the active theme, and the block markup copied from the editor (select the block, then Options → Copy). The form asks for each of these.

Security issues should never be filed as a public issue. Report them privately at [github.com/blicks-dev/blicks/security/advisories/new](https://github.com/blicks-dev/blicks/security/advisories/new).

== Installation ==

= Minimum Requirements =

* WordPress 7.0 or greater
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
5. Optional: visit **Blicks → Design System** to pick a design language, a palette and type roles.

For guides and the generated block reference, visit [docs.blicks.dev](https://docs.blicks.dev/?utm_source=wporg&utm_medium=referral&utm_campaign=evergreen&utm_content=readme-install).

== Frequently Asked Questions ==

= Is this a page builder? =

No. Blicks lives inside the native block editor and adds layout and content primitives — Section, Box, Form, Loop and the rest — that you compose the same way you compose any other block. Nothing replaces your editor.

= I use Blicks 1.x. What happens when I update to 2.0? =

Blicks 2.0 is a clean break. It does not convert layouts built with 1.x: Stack, Grid, Spacer and Divider are gone (they are now kinds and arrangements of Box), and the blocks that carry on save different markup. Pages built with 1.x keep their saved HTML, but the editor shows the removed blocks as blocks it does not recognize and may report the others as invalid. Try 2.0 on a staging copy first, and see [docs.blicks.dev/upgrading](https://docs.blicks.dev/upgrading?utm_source=wporg&utm_medium=referral&utm_campaign=evergreen&utm_content=readme-faq-upgrade) for how each 1.x layout maps onto 2.0.

= Does Blicks work with my theme? =

It is built for block themes and full site editing, where it reads the presets your `theme.json` defines and resolves its own tokens through them. It also runs on classic themes, but falls back to its own default token values, since there is no `theme.json` to sync with.

= Does Blicks replace my theme's design system? =

No. Blicks keeps its own catalog of token slugs, and their values alias your theme's preset variables where the theme defines them. Where it defines none — a shadow scale, say — Blicks supplies its own, so a control is never empty.

= Will it slow down my site? =

Blicks blocks save static HTML, except Section, Form, Field, Input and Loop, which render on the server from the attributes they save. There is no per-block `<style>` tag and no per-request CSS generation for token and utility values. Per-instance rules — pseudo-elements, container queries, keyframes — are collected and deduplicated into a single block in the footer.

= What happens to my content if I deactivate Blicks? =

Blocks save static HTML, so the markup stays in the post. Blicks' stylesheets stop loading, so the styling they carry goes with them, and blocks rendered on the server — such as Form and Loop — stop rendering.

= What happens to my data if I delete the plugin? =

By default, nothing is removed — your design system, settings and form entries survive a delete and reinstall. If you want Blicks to clean up after itself, set **When Blicks is deleted** to **Remove everything** in **Blicks → Settings** before deleting the plugin. That also deletes every form entry.

= Can an AI agent build pages with Blicks? =

Yes, through MCP (the Model Context Protocol), once an administrator turns it on under **Blicks → MCP**. It is off by default, and while it is off Blicks registers no MCP server and no abilities at all.

An agent signs in with a WordPress application password created for your account, so it can do exactly what your account can do in the editor and nothing more: it can only read and change posts you could edit yourself, and it can publish only where you could publish. It can list the Blicks blocks, read the design system, check a layout, read a page, create a draft and replace a page's blocks. Every change is validated the way the editor validates it, refused whole if anything is wrong, and the previous version is kept as a revision. An agent may not add scripts, event handlers, embedded frames or forms, or unsafe links, whichever account it signs in as, and its password works only for the Blicks MCP server. Revoke an agent at any time under **Blicks → MCP** or **Users → Profile → Application Passwords**.

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

1. **The Blicks admin** - The Overview screen, and the Design System screen where design languages, palettes and tokens are edited with your site previewed live.
2. **Theme Settings in the editor** - Colors, type scale and spacing resolved from the active theme's `theme.json`, so they are the same values the front end uses.
3. **Block controls** - Three tabs: Settings for what the block is, Style for how it looks and how it reacts to hover, clicks and focus, and Motion for entrances and transitions.

== External Services ==

Out of the box, Blicks loads no remote fonts, scripts or styles, and nothing it renders on your pages contacts another server. Everything it renders is served from the plugin itself and from your own theme's settings. The services below are used only after an administrator turns them on.

**Loop data endpoints (optional, addresses you choose).** Off by default: Blicks ships with no endpoint. Only when an administrator adds a data source under Blicks › Settings › Data sources and a Loop block uses it, your site (not the visitor's browser) requests that address to read the JSON list the Loop shows. The request is a plain GET with an `Accept: application/json` header and a `Blicks/<version>` user agent; it carries nothing about your site, its content or its visitors. The answer is cached on your site for the time the administrator chooses (five minutes to one day) and refreshed in the background, so visitors never trigger the request directly once a first answer is cached. The service, its provider and its terms are whichever the administrator chose; review that provider's privacy policy and terms before adding it.

**Google reCAPTCHA (optional spam check for forms).** Off by default. Only when an administrator enters reCAPTCHA keys in Blicks › Settings › Forms and picks reCAPTCHA v3 or v2 for a Form, pages that show that form load Google's reCAPTCHA script from www.google.com. Google's script collects information about the visitor's browser and interaction (such as IP address, browser and device details, and how the page is used) to tell people from bots. When the form is sent, your site sends the challenge response and your secret key to Google's verification service (https://www.google.com/recaptcha/api/siteverify); the visitor's IP address is not added to that request, and the form's contents are never sent. Service provider: Google LLC. Privacy policy: https://policies.google.com/privacy. Terms of service: https://policies.google.com/terms.

**Cloudflare Turnstile (optional spam check for forms).** Off by default. Only when an administrator enters Turnstile keys in Blicks › Settings › Forms and picks Turnstile for a Form, pages that show that form load Cloudflare's Turnstile script from challenges.cloudflare.com. The script collects information about the visitor's browser and device to tell people from bots. When the form is sent, your site sends the challenge response and your secret key to Cloudflare's verification service (https://challenges.cloudflare.com/turnstile/v0/siteverify); the visitor's IP address is not added to that request, and the form's contents are never sent. Service provider: Cloudflare, Inc. Privacy policy: https://www.cloudflare.com/privacypolicy/. Terms of service: https://www.cloudflare.com/website-terms/.

**The Blicks marketplace (optional, for editors).** Off by default. Until an administrator turns on **Show the Marketplace in the Studio** under Blicks › Settings › Marketplace, the Studio library's Marketplace shelf makes no request and loads no preview; it only says where the setting is. Once it is on, two things happen, both only while someone who can edit posts has the Studio library open, never on your site's public pages:

* Your site (not the visitor's browser) asks the Blicks marketplace at showcase.blicks.dev for its list of designs and, when an editor adds or opens one, for that design's blocks. Each request carries the search and filters chosen on the shelf, and WordPress's standard user agent, which includes your site's address. Nothing about your posts, your visitors or your users is sent. The list is cached on your site for five minutes; each design that is opened is fetched fresh and counted as an install.
* The editor's browser loads each design's preview image and live preview frame from showcase.blicks.dev, which, like any web page, receives that browser's IP address and user agent.

A companion plugin can add its own `X-Blicks-*` headers, such as a license key, to the site's requests through the `blicks_marketplace_request_headers` filter; those headers never reach the browser. A site can point the shelf at another address with the `BLICKS_MARKETPLACE_URL` constant. Service provider: Blicks, https://blicks.dev. Privacy policy: https://blicks.dev/privacy/. Terms of service: https://blicks.dev/terms/.

The only exception is one you control: if you set a background image to an address on another site, the visitor's browser loads that image from wherever you pointed it. Blicks itself makes no such request.

== Source Code ==

The JavaScript and CSS in the `build/` directory are compiled. The full, human-readable source they are built from — TypeScript, SCSS, the block definitions and the build configuration — is public at:

https://github.com/blicks-dev/blicks

To rebuild the plugin from source you need Node.js 20+ and pnpm:

1. `git clone https://github.com/blicks-dev/blicks.git && cd blicks`
2. `pnpm install`
3. `pnpm build` — writes the compiled assets to `build/`.

The PHP in `src/` is shipped as source and is not compiled. The `vendor/` directory in the release holds two GPL-2.0-or-later packages, installed unmodified by Composer: the WordPress MCP Adapter (`wordpress/mcp-adapter`, https://github.com/WordPress/mcp-adapter), which serves Blicks' MCP tools (with its dependency `wordpress/php-mcp-schema`), and Jetpack's autoloader (`automattic/jetpack-autoloader`), which lets the newest copy of the adapter win when other plugins bundle it too. Composer is otherwise used just for the development tools (PHPUnit, PHP_CodeSniffer), which are never shipped.

== Third-Party Licenses ==

Blicks bundles the WordPress MCP Adapter and Jetpack's autoloader, both GPL-2.0-or-later. Blicks includes a curated icon registry generated from Lucide icons. Lucide is licensed under ISC; some Lucide icons derive from Feather icons, licensed under MIT. Full notices are in `licenses.txt` and in the generated icon registry metadata.

== Changelog ==

= 2.0.0 =

A clean break: Blicks 2.0 rewrites the blocks, the inspector and the style engine, and does not convert layouts built with 1.x.

* New: List and List item — bulleted, numbered and icon lists with done, highlighted and left-out items.
* New: Steps and Step — steppers, "how it works" rows and timelines with a current step.
* New: Form, Field and Input — contact and sign-up forms with templates, Blicks → Entries, email notifications and built-in spam checks, plus optional reCAPTCHA or Turnstile.
* New: Dialog — modals, drawers, bottom sheets and full screens on the browser's own `<dialog>` element.
* New: Loop — repeat a card for every item in pasted JSON, a data endpoint or a WordPress query, with pages.
* New: Menu link — a link with a description line, an icon and a badge.
* New: The inspector has three tabs, Settings, Style and Motion, with sections named for what you want to do. On hover, When clicked and Keyboard focus are ready-made looks you can customize, phone layouts are switches on each block, and All settings lists every value a block stores.
* New: A rebuilt Design System screen with design languages, palettes, kits and a live preview of your site.
* New: Blicks Studio, a full-screen workspace for composing a section from the pattern library.
* New: The MCP server and its abilities, registered with the WordPress Abilities API, for AI agents. Off until an administrator turns it on.
* New: Extension API 2 for companion plugins, with a read-only description of the style engine and a validator in PHP and JavaScript.
* Removed: The Stack, Grid, Spacer and Divider blocks. Box covers all four: Stack and Grid are Box arrangements, Spacer and Divider are kinds of Box.
* Removed: The state and device switchers in the inspector.
* Removed: 1.x saved markup and its deprecations. 1.x layouts are not converted.
* Changed: WordPress 7.0 or newer is required.

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

= 2.0.0 =
A clean break: 2.0 does not convert 1.x layouts. Stack, Grid, Divider and Spacer are removed and other blocks save new markup. Test on a staging copy and read docs.blicks.dev/upgrading first.

= 1.0.1 =
Adds each block's icon to its metadata, and fixes a stale front-end stylesheet after CSS-only updates.

= 1.0.0 =
First public release.
