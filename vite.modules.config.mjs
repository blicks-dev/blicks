import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Front-end **Script Module** build — separate from the classic-IIFE `vite.config.mjs`.
 *
 * WordPress Interactivity API view scripts are ES modules, the OPPOSITE of the classic block
 * scripts: they keep real `import`/`export`, and `@wordpress/interactivity` must stay a BARE
 * specifier so WP's front-end import map resolves it at runtime (do NOT rewrite it to a `wp.*`
 * global, and do NOT IIFE-wrap). So they get their own Rollup pass with `format: 'es'`.
 *
 * Discovers `resources/blocks/<name>/view.ts` → emits `build/blocks/<name>/view.js` (ESM) plus a
 * `view.asset.php` manifest (deps `@wordpress/interactivity`, content hash version) that
 * `register_block_type` reads for the block.json `viewScriptModule` handle.
 *
 * Runs with `emptyOutDir: false` so it layers onto the classic build's `build/` output.
 */
const BLOCKS_DIR = 'resources/blocks';

/** WP-provided script modules kept as bare imports (resolved by the front-end import map). */
const WP_MODULES = [ '@wordpress/interactivity', '@wordpress/interactivity-router' ];

function discoverViewScripts() {
	const entries = {};
	if ( ! existsSync( BLOCKS_DIR ) ) return entries;
	for ( const dir of readdirSync( BLOCKS_DIR, { withFileTypes: true } ) ) {
		if ( ! dir.isDirectory() ) continue;
		for ( const ext of [ 'view.ts', 'view.js' ] ) {
			const file = resolve( BLOCKS_DIR, dir.name, ext );
			if ( existsSync( file ) ) {
				entries[ `blocks/${ dir.name }/view` ] = file;
				break;
			}
		}
	}
	return entries;
}

/** Emit a `*.asset.php` next to each view module so PHP reads its script-module dependencies. */
function viewAssets() {
	return {
		name: 'blicks-view-assets',
		apply: 'build',
		generateBundle( _options, bundle ) {
			for ( const [ fileName, chunk ] of Object.entries( bundle ) ) {
				if ( chunk.type !== 'chunk' || ! chunk.isEntry ) continue;
				const deps = ( chunk.imports || [] ).filter( ( id ) => WP_MODULES.includes( id ) );
				const list = deps.map( ( d ) => `'${ d }'` ).join( ', ' );
				const version = createHash( 'sha1' ).update( chunk.code ).digest( 'hex' ).slice( 0, 20 );
				this.emitFile( {
					type: 'asset',
					fileName: fileName.replace( /\.js$/, '.asset.php' ),
					source: `<?php return array( 'dependencies' => array( ${ list } ), 'version' => '${ version }' );\n`,
				} );
			}
		},
	};
}

const input = discoverViewScripts();

/* global process, console */
if ( Object.keys( input ).length === 0 ) {
	// No Interactivity API blocks in the tree right now — rollup errors on an empty input map.
	console.log( '[vite.modules.config] no view.ts entries found, skipping.' );
	process.exit( 0 );
}

export default defineConfig( {
	plugins: [ viewAssets() ],
	esbuild: { jsx: 'automatic' },
	resolve: { alias: { '@': resolve( 'resources' ) } },
	build: {
		outDir: 'build',
		emptyOutDir: false,            // layer onto the classic build, don't wipe it
		manifest: false,
		cssCodeSplit: false,
		rollupOptions: {
			input,
			external: WP_MODULES,
			preserveEntrySignatures: 'strict',
			output: {
				format: 'es',
				entryFileNames: '[name].js',     // build/blocks/<name>/view.js
				chunkFileNames: 'blocks/_shared/[name]-[hash].js',
			},
		},
	},
} );
