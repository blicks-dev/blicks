/**
 * Vite plugin for Blicks ADDON builds — not used by Blicks itself.
 *
 * Does for `@blicks/framework` exactly what `@kucrut/vite-for-wp`'s `wp_scripts()` does for
 * `@wordpress/*`: keeps the import out of the bundle and points it at the global the Blicks
 * editor bundle already published. Without it an addon would compile its own copy of the block
 * factory and control registry, and two copies means two registries — a failure that is silent
 * rather than loud.
 *
 * Sub-paths map one-to-one onto the namespaces, mirroring `@wordpress/blocks` -> `wp.blocks`:
 *
 *   import { defineBlock } from '@blicks/framework/blocks'   -> window.blicks.blocks
 *   import { getValue }    from '@blicks/framework/values'   -> window.blicks.values
 *   import { Inspector }   from '@blicks/framework/inspector' -> window.blicks.inspector
 *   import { STYLE_MAP }   from '@blicks/framework/style'    -> window.blicks.style
 *   import { TOKENS }      from '@blicks/framework/design'   -> window.blicks.design
 *   import * as blicks     from '@blicks/framework'          -> window.blicks
 *
 * The addon must also declare the `blicks-editor` script handle as a dependency, or the global
 * will not exist when its code runs:
 *
 *   wp_enqueue_script( 'my-addon', $url, [ 'blicks-editor' ], $ver, true );
 */

const NAMESPACES = [ 'blocks', 'values', 'style', 'inspector', 'design' ];

const PACKAGE = '@blicks/framework';

/** `@blicks/framework/values` -> `window.blicks.values`; the bare package -> `window.blicks`. */
export function globalFor( id ) {
	if ( id === PACKAGE ) return 'window.blicks';

	const suffix = id.startsWith( `${ PACKAGE }/` ) ? id.slice( PACKAGE.length + 1 ) : null;
	if ( suffix && NAMESPACES.includes( suffix ) ) return `window.blicks.${ suffix }`;

	return null;
}

export default function blicksExternals() {
	return {
		name: 'blicks-externals',
		config() {
			return {
				build: {
					rollupOptions: {
						external: ( id ) => globalFor( id ) !== null,
						output: {
							// Rollup reads this for iife/umd output, which is what a WordPress
							// script (a classic script, not a module) has to be.
							globals: ( id ) => globalFor( id ) ?? id,
						},
					},
				},
			};
		},
	};
}
