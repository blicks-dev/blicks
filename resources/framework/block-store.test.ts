/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getBlockRegistry, setBlockRegistry } from './block-store';

/**
 * Nothing may reach `core/block-editor` through the module-level `select` / `dispatch`.
 *
 * Those are bound to the GLOBAL registry and ignore `RegistryProvider`, so inside a nested
 * `BlockEditorProvider` they read and write the post instead of the mounted tree. Measured on
 * 2026-10-01: with a nested provider holding three blocks, the global selector returned the post's
 * one block.
 *
 * It is invisible in a single-store editor, which is why it needs a test rather than a convention:
 * the day a second store exists, six files silently edit the wrong document and the editor still
 * looks like it works. `framework/block-store.ts` is the one place allowed to bind them.
 */

const ROOT = resolve( __dirname, '..' );

/** The only module permitted to import the registry-bound accessors. */
const ALLOWED = [ 'framework/block-store.ts' ];

function sources( dir: string, found: string[] = [] ): string[] {
	for ( const entry of readdirSync( dir ) ) {
		if ( entry === 'node_modules' || entry.startsWith( '.' ) ) continue;
		const path = join( dir, entry );
		if ( statSync( path ).isDirectory() ) {
			sources( path, found );
		} else if ( /\.tsx?$/.test( entry ) && ! /\.test\.tsx?$/.test( entry ) ) {
			found.push( path );
		}
	}
	return found;
}

/**
 * A call on the module-level import, not on a `useSelect` callback's argument.
 *
 * `useSelect( ( select ) => select( 'core/block-editor' ) )` is fine — that `select` is the
 * parameter and resolves through the ambient registry. So a file only offends when it IMPORTS
 * `select`/`dispatch` from `@wordpress/data` and also names the store.
 */
function importsBareAccessor( text: string ): boolean {
	const line = text.match( /import\s*\{([^}]*)\}\s*from\s*'@wordpress\/data'/ );
	if ( ! line ) return false;
	const named = line[ 1 ].split( ',' ).map( ( part ) => part.trim().split( /\s+as\s+/ )[ 0 ].trim() );
	return named.includes( 'select' ) || named.includes( 'dispatch' );
}

describe( 'core/block-editor access', () => {
	it( 'only framework/block-store.ts binds select/dispatch to a registry', () => {
		const offenders = sources( ROOT )
			.filter( ( path ) => {
				const text = readFileSync( path, 'utf8' );
				return importsBareAccessor( text ) && text.includes( "'core/block-editor'" );
			} )
			.map( ( path ) => relative( ROOT, path ) )
			.filter( ( path ) => ! ALLOWED.includes( path ) );

		expect( offenders ).toEqual( [] );
	} );

	it( 'falls back to the global store when no registry is set', () => {
		expect( getBlockRegistry() ).toBeNull();

		const fake = { select: () => 'scoped-select', dispatch: () => 'scoped-dispatch' };
		setBlockRegistry( fake );
		expect( getBlockRegistry() ).toBe( fake );

		setBlockRegistry( null );
		expect( getBlockRegistry() ).toBeNull();
	} );
} );
