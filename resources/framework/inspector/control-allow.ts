/**
 * Which style controls a block accepts.
 *
 * Its own module rather than a helper inside `Inspector.tsx` for two reasons: the rule is shared
 * logic rather than inspector UI, and importing the inspector drags in `@wordpress/block-editor`
 * and a DOM with it — too much to load to test one string comparison.
 *
 * The same rule exists in PHP as `ControlCatalog::allowed()`, because the REST surface can write
 * the style tree and a server that disagreed with the editor about what a block allows would let
 * a caller set a control the inspector then refuses to show. `tests/fixtures/control-glob-cases.json`
 * is the table both sides run.
 */

/**
 * Does a block's `supports.blicks.controls` allow-list permit this control id?
 *
 * The list holds exact ids (`layout.gapRow`) and one-level globs (`spacing.*`). The split is on
 * the FIRST dot, so `spacing.*` covers `spacing.padding.top` as well as `spacing.padding`. A bare
 * `*` is not a wildcard — nothing opts a block into every control at once.
 */
export const includesControl = ( controls: string[], id: string ): boolean =>
	controls.includes( id ) || controls.includes( id.split( '.' )[ 0 ] + '.*' );
