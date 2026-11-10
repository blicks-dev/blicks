# Modules

Pro features built inside the free repository until the v2 release, when each folder moves to
Blicks Pro unchanged. Nothing here ever ships in the free plugin.

## The rules

1. **One folder, self-contained.** Everything for a feature lives in `modules/<name>/`: `module.php`
   (its autoloader and provider), `src/` (PHP), `resources/` (TypeScript, with
   `resources/index.ts(x)` as the entry), and its own blocks and tests.
2. **Final names from the first commit.** PHP namespace `BlicksPro\<Name>`, text domain
   `blicks-pro`. Block names stay `blicks/*`, because a block name is in every saved post.
3. **No reaching in.** TypeScript imports only `@wordpress/*` and the module's own files; the rest
   of Blicks is on `window.blicks.*` at runtime. PHP uses public hooks and the classes allowed in
   `tests/Unit/Modules/ModuleBoundaryTest.php`. If a module needs something the free plugin does not
   expose, the answer is a new public extension point in the free plugin, never an import.
4. **Never in a free release.** A module is built and loaded only when it is named:

   ```bash
   BLICKS_DEV_MODULES=dialog-studio pnpm build   # builds modules/dialog-studio/build/
   ```

   ```php
   define( 'BLICKS_DEV_MODULES', 'dialog-studio' ); // wp-config.php: loads modules/dialog-studio/module.php
   ```

   `pnpm bundle` refuses to run with `BLICKS_DEV_MODULES` set, never packages `modules/`, and checks
   the zip it wrote for any `modules/` path or `BlicksPro` name.
5. **Loaded as Pro will load it.** Through script dependencies on `blicks-studio` or
   `blicks-editor`, `blicks_studio_modes`, `blicks_admin_views` and the block extension API. The move
   is: `git mv` the folder into Blicks Pro, require its `module.php` from Pro's plugin file, add its
   build there, and delete it here.

## What enforces them

| Rule | Check |
|---|---|
| TypeScript imports | eslint `no-restricted-imports` and `blicks/module-boundary` on `modules/**` (`eslint.config.mjs`), tested in `resources/test/module-boundary.test.ts` |
| PHP reach, namespace, text domain | `tests/Unit/Modules/ModuleBoundaryTest.php` |
| Not in the zip | `scripts/bundle.js` and `scripts/check-release-zip.js` |
| Coding standard | `vendor/bin/phpcs --runtime-set text_domain blicks-pro modules/<name>/src modules/<name>/module.php` |

A module's own tests sit in `modules/<name>/tests/`: PHP unit tests in `tests/Unit/` run with the
plugin's (`phpunit.xml`, suite *Modules*); Vitest finds `resources/**/*.test.ts`, which may also
import `vitest` and `node:*`.

`example/` exists to prove the wiring end to end: a trivial Studio mode registered through the
public API only. Delete it once a real module exists.
