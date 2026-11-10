import { defineConfig } from 'vite';
import { wp_scripts } from '@kucrut/vite-for-wp/plugins';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { collectSourceDeps } from './scripts/vite-plugin-wp-assets.mjs';

/**
 * One Pro module (`modules/<name>`), built by `scripts/build-modules.mjs` with `BLICKS_MODULE` set.
 *
 * Its entry is `modules/<name>/resources/index.ts(x)`, and the bundle goes to
 * `modules/<name>/build/index.js` with an `index.asset.php` beside it: the classic-script contract
 * the plugin's own bundles keep, so the module's provider enqueues it the way Pro will after the
 * move. `@wordpress/*` and React are externalised to WordPress's globals; anything else the
 * module needs from Blicks it reads off `window.blicks`, never by import (eslint enforces it).
 *
 * No `@` alias: the alias is how the plugin's own code reaches `resources/`, and a module must not.
 */
const name = process.env.BLICKS_MODULE ?? '';
const dir = resolve( 'modules', name );
const entry = [ 'index.tsx', 'index.ts' ].map( ( file ) => resolve( dir, 'resources', file ) ).find( ( file ) => existsSync( file ) );

if ( ! /^[a-z][a-z0-9-]*$/.test( name ) || ! entry ) {
	throw new Error( `vite.modules.config.mjs: no module "${ name }" with a resources/index.ts(x).` );
}

export default defineConfig( {
	plugins: [
		wp_scripts(),
		{
			name: 'blicks-module-asset',
			enforce: 'post',
			renderChunk( code, chunk ) {
				return chunk.isEntry ? { code: `(function(){\n${ code }\n})();\n`, map: null } : null;
			},
			generateBundle( _options, bundle ) {
				for ( const chunk of Object.values( bundle ) ) {
					if ( 'chunk' !== chunk.type || ! chunk.isEntry ) continue;
					const deps = [ ...collectSourceDeps( chunk.moduleIds ) ].sort();
					const version = createHash( 'sha1' ).update( chunk.code ).digest( 'hex' ).slice( 0, 20 );
					this.emitFile( {
						type: 'asset',
						fileName: chunk.fileName.replace( /\.js$/, '.asset.php' ),
						source: `<?php\ndefined( 'ABSPATH' ) || exit;\nreturn array( 'dependencies' => array( ${ deps.map( ( d ) => `'${ d }'` ).join( ', ' ) } ), 'version' => '${ version }' );\n`,
					} );
				}
			},
		},
	],
	esbuild: { jsx: 'automatic' },
	build: {
		outDir: resolve( dir, 'build' ),
		emptyOutDir: true,
		manifest: false,
		rollupOptions: {
			input: { index: entry },
			preserveEntrySignatures: false,
			output: { entryFileNames: '[name].js', assetFileNames: '[name][extname]' },
		},
	},
} );
