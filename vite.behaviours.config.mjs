import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Front-end behaviours (`blicks_behaviours`): one ES module per `resources/behaviours/<name>.ts`,
 * loaded by WordPress as a script module (`@blicks/<name>`) that imports `@wordpress/interactivity`
 * from core. Only pages that render a block using a behaviour load it (Blicks\Behaviours).
 *
 * Next to each module goes `<name>.asset.php` with its version, the same contract as the classic
 * scripts' manifests. A name may hold a `-` (`hover-intent.ts`); a file ending in `-core.ts` is the
 * behaviour's shared logic (`dialog-core.ts`), and a `.test.ts` a test, neither an entry.
 */
const DIR = resolve( 'resources/behaviours' );

function entries() {
	const found = {};
	if ( ! existsSync( DIR ) ) return found;
	for ( const file of readdirSync( DIR ) ) {
		const match = /^([a-z][a-z0-9-]*)\.ts$/.exec( file );
		if ( match && ! match[ 1 ].endsWith( '-core' ) ) found[ match[ 1 ] ] = resolve( DIR, file );
	}
	return found;
}

export default defineConfig( {
	plugins: [
		{
			name: 'blicks-behaviour-manifests',
			generateBundle( _options, bundle ) {
				for ( const chunk of Object.values( bundle ) ) {
					if ( chunk.type !== 'chunk' || ! chunk.isEntry ) continue;
					const version = createHash( 'sha1' ).update( chunk.code ).digest( 'hex' ).slice( 0, 20 );
					this.emitFile( {
						type: 'asset',
						fileName: chunk.fileName.replace( /\.js$/, '.asset.php' ),
						source: `<?php\ndefined( 'ABSPATH' ) || exit;\nreturn array( 'dependencies' => array( '@wordpress/interactivity' ), 'version' => '${ version }' );\n`,
					} );
				}
			},
		},
	],
	resolve: {
		alias: { '@': resolve( 'resources' ) },
	},
	build: {
		outDir: 'build/behaviours',
		emptyOutDir: true,
		target: 'es2020',
		minify: true,
		rollupOptions: {
			input: entries(),
			external: [ '@wordpress/interactivity' ],
			preserveEntrySignatures: 'strict',
			output: {
				format: 'es',
				entryFileNames: '[name].js',
				chunkFileNames: '[name]-[hash].js',
			},
		},
	},
} );
