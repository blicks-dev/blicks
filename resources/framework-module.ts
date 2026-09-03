/**
 * `@blicks/framework` — the public API as a real WordPress **Script Module**.
 *
 * Addons import it with native ESM, resolved by WordPress's import map:
 *
 *   import { blocks } from '@blicks/framework';
 *   blocks.defineBlock( metadata, { render } );
 *
 * ## Why this file bridges to a global instead of holding the code
 *
 * WordPress has no editor script module. `WP_Block_Type` exposes `view_script_module_ids` for the
 * front end, and `editor_script_handles` — classic scripts only — for the editor. So the bundle
 * that owns the block factory, the value tree and the control registry must stay a classic script,
 * and a module cannot import from one.
 *
 * Compiling the framework a second time into this module would satisfy the import syntax and
 * break everything else: two block registries and two control registries, with blocks registering
 * into one while the editor reads the other. That failure is silent.
 *
 * So this module re-exports the single instance the classic `blicks-editor` bundle publishes. The
 * import is real; only the storage is shared.
 */

const ns = ( window as any ).blicks;

if ( ! ns || typeof ns.apiVersion !== 'number' ) {
	throw new Error(
		'@blicks/framework: window.blicks is not available. The importing script must run after ' +
			'the `blicks-editor` classic script — enqueue it on an editor screen, and check that ' +
			'Blicks is active.'
	);
}

/** Bumped only on a breaking change to the shape below. */
export const apiVersion: number = ns.apiVersion;

/** `defineBlock`, `applyBlockIdentity`. */
export const blocks = ns.blocks;

/** The `(state x breakpoint)` value tree: `getValue`, `setValue`, `STATES`, `BREAKPOINTS`. */
export const values = ns.values;

/** `STYLE_MAP`, `buildElementStyle`, `registerCssValueBuilder`, the CSS sanitizers. */
export const style = ns.style;

/** `Inspector`, `Section`, `ContextBar` and every control component. */
export const inspector = ns.inspector;

/** Tokens, type roles, breakpoints, and the live icon and font registries. */
export const design = ns.design;
