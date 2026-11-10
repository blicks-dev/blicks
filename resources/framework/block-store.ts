import { select as globalSelect, dispatch as globalDispatch } from '@wordpress/data';

/**
 * Reaching `core/block-editor` from code that is not a React component.
 *
 * `useSelect( ( select ) => … )` hands its callback a `select` bound to the AMBIENT registry, so a
 * component inside a nested `BlockEditorProvider` reads the tree that provider owns. The
 * module-level `select` / `dispatch` imported straight from `@wordpress/data` do not: they are
 * bound to the global registry and ignore `RegistryProvider` entirely.
 *
 * That difference is invisible until a second block store exists. Measured on 2026-10-01 against a
 * real editor: with a nested provider holding three blocks, the global
 * `select( 'core/block-editor' ).getBlocks()` returned the POST's one block. Every drag, sweep,
 * delete and occupancy check in the Scene code runs from a DOM event handler rather than a hook,
 * so all of it would have read and written the wrong tree — the worst kind of bug, because the
 * editor still looks like it is working.
 *
 * So: never import `select`/`dispatch` for `core/block-editor` anywhere else. Go through here. A
 * drift test enforces it.
 *
 * ## The ambient registry
 *
 * Set by the surface that owns a mounted tree, from inside its provider, where `useRegistry()`
 * resolves to the sub-registry. Unset on unmount, which puts this back on the global store — so
 * the in-canvas Scene and anything else on the page keep working exactly as before.
 *
 * ONE at a time, deliberately. The same constraint `editor-state.ts` documents for the open
 * Scene: a single full-screen surface owns the editing context, so a single slot describes it.
 * Nesting two mounted trees would need a real context, and nothing asks for that yet.
 */

let ambient: any = null;

/** Point the non-React accessors at a registry, or pass `null` to go back to the global one. */
export function setBlockRegistry( registry: any | null ): void {
	ambient = registry ?? null;
}

/** The registry currently in force. Exported for assertions and tests, not for routine use. */
export function getBlockRegistry(): any | null {
	return ambient;
}

/** `core/block-editor`'s selectors, from whichever registry is in force. */
export function blockSelect(): any {
	return ambient ? ambient.select( 'core/block-editor' ) : globalSelect( 'core/block-editor' );
}

/** `core/block-editor`'s actions, from whichever registry is in force. */
export function blockDispatch(): any {
	return ambient ? ambient.dispatch( 'core/block-editor' ) : globalDispatch( 'core/block-editor' );
}
