#!/usr/bin/env node
/**
 * Build the Pro modules `BLICKS_DEV_MODULES` names, each with `vite.modules.config.mjs`, into
 * `modules/<name>/build/`. Names nothing (the default, and every release): builds nothing.
 *
 * Output stays inside the module's own folder, never under `build/`, which ships in the zip.
 */
import { build } from 'vite';
import { existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { devModules } from './dev-modules.mjs';

const names = devModules();

if ( 0 === names.length ) {
	process.exit( 0 );
}

for ( const name of names ) {
	const dir = resolve( 'modules', name );

	if ( ! existsSync( resolve( dir, 'resources/index.ts' ) ) && ! existsSync( resolve( dir, 'resources/index.tsx' ) ) ) {
		console.error( `BLICKS_DEV_MODULES names "${ name }", but modules/${ name }/resources/index.ts(x) does not exist.` );
		process.exit( 1 );
	}

	console.log( `\nBuilding module ${ name }...` );
	// Read by vite.modules.config.mjs, which Vite loads afresh for each build.
	process.env.BLICKS_MODULE = name;
	await build( { configFile: resolve( 'vite.modules.config.mjs' ) } );
	await buildViews( dir );
}

/**
 * A module's front-end script modules: one per `resources/view/<name>.ts`, built like the free
 * plugin's behaviours (`vite.behaviours.config.mjs`) into `build/view/`, each with an
 * `<name>.asset.php` holding its version. They import only `@wordpress/interactivity`, which
 * WordPress provides; files with a `-` in the name are shared code, not entries.
 */
async function buildViews( dir ) {
	const views = resolve( dir, 'resources/view' );
	const input = {};

	for ( const file of existsSync( views ) ? readdirSync( views ) : [] ) {
		const match = /^([a-z]+)\.ts$/.exec( file );
		if ( match ) input[ match[ 1 ] ] = resolve( views, file );
	}

	if ( 0 === Object.keys( input ).length ) {
		return;
	}

	await build( {
		configFile: false,
		plugins: [
			{
				name: 'blicks-module-view-manifests',
				generateBundle( _options, bundle ) {
					for ( const chunk of Object.values( bundle ) ) {
						if ( 'chunk' !== chunk.type || ! chunk.isEntry ) continue;
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
		build: {
			outDir: resolve( dir, 'build/view' ),
			emptyOutDir: true,
			target: 'es2020',
			minify: true,
			rollupOptions: {
				input,
				external: [ '@wordpress/interactivity' ],
				preserveEntrySignatures: 'strict',
				output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' },
			},
		},
	} );
}
