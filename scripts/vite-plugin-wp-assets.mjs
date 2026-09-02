import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Reproduces what `@wordpress/scripts` did that Vite does not:
 *
 *  1. Emits a WordPress `*.asset.php` manifest next to each entry chunk, so PHP
 *     (`AssetServiceProvider`, `register_block_type`) reads script dependencies
 *     and a cache-busting version — the unchanged wp-scripts contract.
 *  2. Relocates each entry's CSS to `<entry>.css` next to the entry, so a block's
 *     stylesheet lands at `build/blocks/<name>/index.css` (Vite would otherwise
 *     flatten both `index` entries' CSS and collide them into `index2.css`).
 *  3. Copies each `resources/blocks/<name>/block.json` into `build/blocks/<name>/`,
 *     so `BlockServiceProvider` (which scans `build/blocks/`) keeps working.
 *  4. Compiles optional `resources/blocks/<name>/readme.md` files into
 *     `build/blocks/<name>/help.json` for editor/AI consumers.
 *  5. Emits a generated `resources/blocks/shared/help.gen.ts` catalogue with
 *     literal `__()` calls so help strings are visible to gettext scanners.
 */

/** Map an external module id to its WordPress script handle, or null. */
function toHandle( id ) {
	if ( id === 'react' ) return 'react';
	if ( id === 'react-dom' ) return 'react-dom';
	if ( id === 'react/jsx-runtime' ) return 'react-jsx-runtime';
	const m = id.match( /^@wordpress\/(.+)$/ );
	return m ? `wp-${ m[ 1 ] }` : null;
}

/** Default handles by entry kind. Block editor scripts always have these in the editor. */
function defaultDeps( name ) {
	return name.startsWith( 'blocks/' ) || name === 'editor'
		? [ 'wp-blocks', 'wp-block-editor', 'wp-element', 'wp-components', 'wp-i18n', 'wp-data' ]
		: [];
}

/**
 * Collect WP script handles by scanning the original module sources on disk.
 *
 * The bundler's module graph can't be used: `wp_scripts()` externalizes
 * `@wordpress/*` imports by rewriting them to `wp.*` globals during transform,
 * so by generateBundle the imports are gone and `importedIds` never reports
 * them. The source files still spell out every import, so regex those instead.
 */
const IMPORT_RE = /(?:import|export)[^'"`;]*?['"]((?:@wordpress\/[\w-]+)|react(?:\/jsx-runtime)?|react-dom)['"]/g;

function collectSourceDeps( moduleIds ) {
	const deps = new Set();

	for ( const moduleId of moduleIds ) {
		const file = moduleId.split( '?' )[ 0 ];
		if ( ! /\.(?:[cm]?js|jsx|ts|tsx)$/.test( file ) || ! existsSync( file ) ) continue;

		// esbuild's automatic JSX runtime injects `react/jsx-runtime` after this scan.
		if ( /\.(?:tsx|jsx)$/.test( file ) ) deps.add( 'react-jsx-runtime' );

		const code = readFileSync( file, 'utf8' );
		for ( const match of code.matchAll( IMPORT_RE ) ) {
			const handle = toHandle( match[ 1 ] );
			if ( handle ) deps.add( handle );
		}
	}

	return deps;
}

function phpManifest( deps, version ) {
	const list = deps.map( ( d ) => `'${ d }'` ).join( ', ' );
	return `<?php return array( 'dependencies' => array( ${ list } ), 'version' => '${ version }' );\n`;
}

function normalizeHelpText( lines ) {
	return lines
		.join( '\n' )
		.replace( /\n{3,}/g, '\n\n' )
		.trim();
}

function pushTip( tips, lines ) {
	const text = normalizeHelpText( lines );
	if ( text ) tips.push( text );
}

function parseHelpMarkdown( source ) {
	const help = { description: '', controls: {}, tips: [] };
	const lines = source.replace( /\r\n?/g, '\n' ).split( '\n' );
	let section = '';
	let controlId = '';
	let buffer = [];

	function flush() {
		if ( section === 'description' ) {
			help.description = normalizeHelpText( buffer );
		} else if ( section === 'control' && controlId ) {
			const text = normalizeHelpText( buffer );
			if ( text ) help.controls[ controlId ] = text;
		} else if ( section === 'tips' ) {
			pushTip( help.tips, buffer );
		}
		buffer = [];
	}

	for ( const line of lines ) {
		const h2 = line.match( /^##\s+(.+?)\s*$/ );
		const h3 = line.match( /^###\s+(.+?)\s*$/ );

		if ( h2 ) {
			flush();
			controlId = '';
			const title = h2[ 1 ].trim().toLowerCase();
			section = title === 'description' ? 'description' : title === 'controls' ? 'controls' : title === 'tips' ? 'tips' : '';
			continue;
		}

		if ( h3 && ( section === 'controls' || section === 'control' ) ) {
			flush();
			section = 'control';
			controlId = h3[ 1 ].trim();
			continue;
		}

		if ( section === 'tips' ) {
			const item = line.match( /^\s*[-*]\s+(.+?)\s*$/ );
			if ( item ) {
				pushTip( help.tips, buffer );
				buffer = [ item[ 1 ] ];
				continue;
			}
		}

		if ( section ) buffer.push( line );
	}

	flush();

	return help;
}

function jsString( value ) {
	return JSON.stringify( value );
}

function helpTsValue( text ) {
	return `__( ${ jsString( text ) }, 'blicks' )`;
}

function helpTsObject( help ) {
	const controls = Object.entries( help.controls )
		.map( ( [ id, text ] ) => `${ jsString( id ) }: ${ helpTsValue( text ) }` )
		.join( ',\n\t\t\t' );
	const tips = help.tips.map( helpTsValue ).join( ', ' );

	return `{
\t\tdescription: ${ helpTsValue( help.description ) },
\t\tcontrols: {
\t\t\t${ controls }
\t\t},
\t\ttips: [ ${ tips } ],
\t}`;
}

function collectBlockHelp( blocksDir ) {
	const helps = {};
	if ( ! existsSync( blocksDir ) ) return helps;

	for ( const dir of readdirSync( blocksDir, { withFileTypes: true } ) ) {
		if ( ! dir.isDirectory() ) continue;
		const helpFile = resolve( blocksDir, dir.name, 'readme.md' );
		if ( existsSync( helpFile ) ) {
			helps[ dir.name ] = parseHelpMarkdown( readFileSync( helpFile, 'utf8' ) );
		}
	}

	return helps;
}

function writeGeneratedHelp( blocksDir, outFile ) {
	const helps = collectBlockHelp( blocksDir );
	const body = Object.entries( helps )
		.sort( ( [ a ], [ b ] ) => a.localeCompare( b ) )
		.map( ( [ name, help ] ) => `\t${ jsString( name ) }: ${ helpTsObject( help ) }` )
		.join( ',\n' );

	const source = `// Generated by scripts/vite-plugin-wp-assets.mjs from resources/blocks/*/readme.md.
// Do not edit by hand.
import { __ } from '@wordpress/i18n';

export interface GeneratedBlockHelp {
\tdescription: string;
\tcontrols: Record< string, string >;
\ttips: string[];
}

export const GENERATED_BLOCK_HELP: Record< string, GeneratedBlockHelp > = {
${ body }
};
`;

	mkdirSync( resolve( outFile, '..' ), { recursive: true } );
	writeFileSync( outFile, source );
}

export default function wpAssets( { blocksDir = 'resources/blocks', generatedHelp = 'resources/blocks/shared/help.gen.ts' } = {} ) {
	return {
		name: 'blicks-wp-assets',
		apply: 'build',
		buildStart() {
			writeGeneratedHelp( blocksDir, generatedHelp );
		},
		generateBundle( _options, bundle ) {
			for ( const [ fileName, chunk ] of Object.entries( bundle ) ) {
				if ( chunk.type !== 'chunk' || ! chunk.isEntry ) continue;

				// 1. dependency manifest (.asset.php)
				const deps = new Set( [
					...defaultDeps( chunk.name ),
					...collectSourceDeps( Object.keys( chunk.modules ) ),
				] );
				const version = createHash( 'sha1' ).update( chunk.code ).digest( 'hex' ).slice( 0, 20 );
				this.emitFile( {
					type: 'asset',
					fileName: fileName.replace( /\.js$/, '.asset.php' ),
					source: phpManifest( [ ...deps ], version ),
				} );
			}

			// 2. copy block.json (+ render.php for dynamic blocks) into build/blocks/<name>/
			if ( existsSync( blocksDir ) ) {
				for ( const dir of readdirSync( blocksDir, { withFileTypes: true } ) ) {
					if ( ! dir.isDirectory() ) continue;
					const src = resolve( blocksDir, dir.name, 'block.json' );
					if ( ! existsSync( src ) ) continue;
					this.emitFile( {
						type: 'asset',
						fileName: `blocks/${ dir.name }/block.json`,
						source: readFileSync( src, 'utf8' ),
					} );
					const php = resolve( blocksDir, dir.name, 'render.php' );
					if ( existsSync( php ) ) {
						this.emitFile( {
							type: 'asset',
							fileName: `blocks/${ dir.name }/render.php`,
							source: readFileSync( php, 'utf8' ),
						} );
					}
					const help = resolve( blocksDir, dir.name, 'readme.md' );
					if ( existsSync( help ) ) {
						this.emitFile( {
							type: 'asset',
							fileName: `blocks/${ dir.name }/help.json`,
							source: JSON.stringify( collectBlockHelp( blocksDir )[ dir.name ], null, 2 ) + '\n',
						} );
					}
				}
			}
		},
	};
}
