# Blicks

Composable Gutenberg blocks with a theme-native design system.

Blicks adds 12 layout and content blocks to the WordPress block editor — Section, Box, Stack, Grid,
Heading, Text, Buttons, Button, Image, Icon, Spacer and Divider. They share one design system that
reads your active theme's `theme.json` rather than shipping its own defaults, so Blicks tokens
(`--blicks-*`) map onto WordPress preset variables (`--wp--preset--*`, `--wp--custom--*`). Change a
value in your theme and it applies everywhere.

Token values compile to utility classes; custom values become scoped CSS variables instead of inline
styles. Built for block themes and full site editing.

- **Requires:** WordPress 6.5+, PHP 8.1+
- **Licence:** GPL-2.0-or-later
- **Website:** https://blicks.dev

## Install

Download the zip from the [releases page](../../releases) and upload it under
**Plugins → Add New → Upload Plugin**, or install from the WordPress.org plugin directory.

## Development

Requires Node 22+, pnpm 10 and PHP 8.1 with Composer.

```bash
pnpm install
composer install
pnpm build        # three passes: editor bundle, block library, view modules
```

The build must run all three passes — a bare `vite build` wipes `build/` and drops
`block-library.js`. `pnpm build` is the only supported entry point.

| Command | What it does |
|---|---|
| `pnpm dev` | All three builds in watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:css` | ESLint / Stylelint |
| `pnpm test` | Vitest — the saved-markup contract that guards against block validation drift |
| `pnpm env:start` / `env:stop` | Start or stop the local WordPress (Docker, via `wp-env`) at http://localhost:8888 |
| `pnpm test:integration` | PHPUnit against a **real** WordPress — routes, capabilities, block registration, Global Styles, uninstall |
| `composer test` / `composer lint` | PHPUnit / PHPCS (WordPress coding standards) |
| `pnpm bundle` | Builds, generates translations, installs production Composer deps, writes `dist/blicks.zip` |

`pnpm bundle` shells out to wp-cli to generate translations, and wp-cli is a `.phar`. If your
`php` is a version-manager shim rather than a real binary, the phar cannot map itself and the
bundle stops with the exact command to work around it. CI is unaffected.

To develop against a real site, symlink this checkout into a WordPress install:

```bash
ln -s /path/to/blicks-plugin /path/to/wp-content/plugins/blicks
```

### Git hooks

`pnpm install` points git at `.githooks/` (via the `prepare` script), so a clone plus an install
is all it takes.

| Hook | Does |
|---|---|
| `pre-commit` | Runs phpcbf over staged PHP, stages what it fixed, then runs phpcs. Only files the ruleset scans, so `tests/` is untouched. |
| `commit-msg` | Enforces the commit contract: Conventional Commits subject (72 chars or fewer, no trailing period), author `Prakash Khadka <prakhadkash@gmail.com>`, and no Claude or Anthropic attribution in the message. |
| `pre-push` | `composer test` and `pnpm test`. |

`pre-commit` refuses to auto-fix a file that is only *partially* staged — phpcbf rewrites the
whole working copy, and staging that would sweep in edits the commit was never meant to carry.
It names the file and stops.

`pre-push` deliberately skips the WordPress integration suite: it needs a wp-env container start,
which is far too slow for a push. CI runs it on every pull request.

Commits are authored as `Prakash Khadka <prakhadkash@gmail.com>`. Set it once per clone:

```bash
git config user.name "Prakash Khadka"
git config user.email "prakhadkash@gmail.com"
```

All three are bypassable with `--no-verify` when you need it.

## Documentation

The public documentation site lives in [`docs/`](docs/) and is built with Mintlify. Mintlify's
GitHub integration watches that directory on `main` and rebuilds on every push, so there is no
deploy step.

```bash
cd docs && pnpm install    # docs carry their own dependencies
pnpm generate              # rebuild the block reference from resources/blocks
pnpm dev                   # preview the site locally
pnpm check                 # generate, then check for broken links
```

`docs/` installs separately from the plugin. The Mintlify CLI is heavy and nothing else needs it,
so the build, test and release jobs never install it — the same isolation `tests/integration/`
uses for its Composer project.

Mintlify does **not** run build scripts, so the generated block reference under
`docs/reference/blocks/` is committed. Run `pnpm generate` and commit the result whenever a
`block.json` or a per-block `readme.md` changes; CI fails the build if the committed copy has
drifted. Nothing under `docs/` reaches the release zip — `scripts/bundle.js` ships an allowlist.

## Continuous integration

| Workflow | Trigger | What it does |
|---|---|---|
| `checks.yml` | called by the two below | The shared gate: JS build/typecheck/lint/test, PHPCS, PHPUnit on PHP 8.4 + 8.5, a production `composer install` on 8.1/8.2/8.3 to prove the shipped dependency set works at the declared floor, the WordPress integration suite on WP 6.5 + latest, and the Playground e2e suite |
| `ci.yml` | push to `main`, every PR | Runs `checks.yml` |
| `plugin-check.yml` | every PR | Bundles the release zip and runs the official WordPress.org Plugin Check against it |
| `release.yml` | `v*` tag | `checks.yml` → version guard → bundle → Plugin Check → GitHub Release → WordPress.org SVN deploy |
| `docs.yml` | `docs/**` or `resources/blocks/**` | Regenerates the block reference and fails if the committed copy has drifted, then checks the docs for broken links |
| `wporg-assets.yml` | `.wordpress-org/**` on `main`, or run by hand | Pushes the listing artwork (banners, icons, screenshots) to SVN without cutting a release. `readme.txt` is excluded on purpose — it carries `Stable tag:`, so the release deploy publishes it together with the tag it names |

> **Directory artwork is outstanding.** `.wordpress-org/` holds no icon, banner or screenshots, so
> the listing has none. The asset steps sync whatever is there, so nothing fails in the meantime.
> Adding screenshots means adding a matching `== Screenshots ==` section to `readme.txt` as well.
> Required sizes: [`.wordpress-org/README.md`](.wordpress-org/README.md).

### Tests

Four suites, each answering a different question.

| Suite | Runs on | Answers |
|---|---|---|
| `pnpm test` (Vitest) | Node | Does the block markup still match its golden files, and does the framework logic hold? |
| `composer test` (PHPUnit 13) | PHP, no WordPress | Is the pure logic — tokens, projections, CSS generation — correct? |
| `pnpm test:integration` (PHPUnit 9) | Real WordPress, in Docker | Does the plugin actually wire itself up? |
| `tests/e2e` (Playwright) | Real WordPress, in a browser | Can a person insert every block, and does the front end render what they built? |

The e2e suite drives the real WordPress editor through **WordPress Playground** — WordPress
compiled to WebAssembly, so there is no Docker, no MySQL and nothing to install. Playwright boots
it with `tests/e2e/blueprint.json` and *mounts the working tree* as the plugin, so the suite tests
the plugin exactly as it is on disk rather than a built artifact. Run it with
`cd tests/e2e && pnpm install && pnpm test`; it needs `pnpm build` and `composer install` to have
run first, because a mounted plugin is source, not a package.

It carries the coverage that unit tests structurally cannot: that a block survives a real publish,
that the dynamic Section block's `render.php` executes, and that the PHP style engine emits its
custom properties into the page a visitor loads.

The integration suite exists because the unit suite runs against hand-written stubs of
`WP_Error` and friends, which cannot prove that a REST route registered, that a capability
check fires, that all 12 blocks registered from their `block.json`, or that uninstall removes
only what the plugin owns. It covers exactly that wiring layer, plus `GlobalStylesWriter`,
which writes into the user's own Global Styles post and is the one class where a mistake
destroys work the plugin did not create.

It uses **PHPUnit 9, isolated in `tests/integration/`** with its own `composer.json`. That is
not an oversight: the WordPress test library calls `PHPUnit\Util\Test::parseTestMethodAnnotations()`,
removed in PHPUnit 10, so it cannot run on the PHPUnit 13 the unit suite uses. The root
`composer.json` sets `"prepend-autoloader": false` so the plugin's own autoloader does not
jump ahead of the integration suite and serve it the wrong PHPUnit.

Two notes on the matrix. PHPUnit 13 requires PHP 8.4+, so tests cannot run on the 8.1 the plugin
supports; the 8.1 floor is enforced instead by PHPCompatibilityWP in `phpcs.xml.dist`
(`testVersion 8.1-`) plus a real production install and `php -l` sweep on 8.1/8.2/8.3. And several
dependencies are pinned exactly — newer `@wordpress/global-styles-engine` breaks `private-apis`,
newer `lucide-static` redraws glyphs and invalidates the icon golden files — so Dependabot is
limited to GitHub Actions and those are bumped by hand.

## Branching

`main` plus short-lived feature branches. There is no `develop` and no `release/*`: releases are
driven by tags, not branches, and the WordPress.org stable tag already is the production pointer.

```
feat/thing → PR → checks + plugin-check green → squash-merge to main → tag v1.0.0
```

Branch names follow the commit convention — `feat/`, `fix/`, `docs/`, `chore/`, `ci/`.

`main` should require a pull request, block force-pushes and deletion, and require these checks:

```
checks / js
checks / php-lint
checks / php-8.4-test
checks / php-8.5-test
checks / php-8.1-prod
checks / php-8.2-prod
checks / php-8.3-prod
plugin-check
```

A maintenance branch is only worth creating when it is actually needed — a patch to an old release
while `main` has moved on. Cut it from the tag at that moment (`git switch -c 1.0.x v1.0.2`) rather
than keeping a long-lived branch that nothing uses.

## Releasing

**Prerequisite:** add `SVN_USERNAME` and `SVN_PASSWORD` (a WordPress.org account with commit access
to the `blicks` plugin) as repository secrets. Without them the release still publishes to GitHub
and only the SVN step fails.

Bump the version on `main` **first**, then tag that commit — `check-version.mjs` fails the release
if the tag and the declared version disagree, so tagging ahead of the bump aborts before anything
is built.

Push a `v<version>` tag. The version must match in three places — the `blicks.php` header, the
`BLICKS_VERSION` constant and the `readme.txt` stable tag — or the version guard stops the release
before anything is built. Prerelease tags (`v1.0.0-rc.1`) publish a GitHub Release and deliberately
stop there: WordPress.org has no notion of a prerelease, and its stable tag is a live pointer for
every existing install.

## Licence

GPL-2.0-or-later. See [LICENSE](LICENSE); bundled third-party licences are listed in
[licenses.txt](licenses.txt).
