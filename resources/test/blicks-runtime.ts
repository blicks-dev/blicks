/**
 * The free plugin, loaded as WordPress loads it ahead of a companion's script: every Blicks block
 * registered and the public API on `window.blicks`.
 *
 * For a Pro module's tests only (`modules/<name>/tests`). A module's code reaches Blicks through
 * `window.blicks.*` at runtime, never by import, and its tests keep to that: they import this one
 * name, `@blicks/test-runtime` (vitest.config.mjs, tsconfig.json), the way a page has the free
 * plugin's script before the module's. eslint allows it in module test files and nowhere else.
 */
import '@/block-library';
