/**
 * Publishes the public API on `window.blicks` for addon plugins.
 *
 * This runs from the editor bundle, which WordPress registers as `blicks-editor` — the handle
 * every Blicks block already declares as its `editorScript`. An addon depending on that handle is
 * therefore guaranteed the API is present and, more importantly, is guaranteed to share the ONE
 * copy of the block factory, value tree and control registry that this bundle contains.
 *
 * The namespace is MERGED, never replaced: `resources/framework/icons` and the font library
 * already register themselves onto `window.blicks` with `??=`, and module evaluation order
 * between them and this file is not guaranteed.
 */

import { apiVersion, blocks, values, style, inspector, design } from '@/api';

const ns = ( window.blicks ??= {} );

Object.assign( ns, {
	apiVersion,
	blocks,
	values,
	style,
	inspector,
	design,
} );
