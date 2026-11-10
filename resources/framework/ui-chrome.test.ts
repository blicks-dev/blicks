import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_DARK_VARS, UI_VARS } from './ui-chrome';

const here = dirname( fileURLToPath( import.meta.url ) );
const read = ( path: string ) => readFileSync( resolve( here, path ), 'utf8' );

/** The `--bl-ui-*` names `@mixin palette` declares. */
function declaredInPalette(): string[] {
	const scss = read( './_ui-tokens.scss' );
	const start = scss.indexOf( '@mixin palette' );
	const end = scss.indexOf( '\n}', start );
	const body = scss.slice( start, end );
	return [ ...body.matchAll( /^\s*(--bl-ui-[a-z0-9-]+)\s*:/gm ) ].map( ( m ) => m[ 1 ] );
}

describe( 'the chrome variable contract', () => {
	it( 'lists exactly what the palette mixin declares', () => {
		// A missing name is a breaking change for companion CSS; an unlisted one is a contract nobody
		// decided to make. Both fail here.
		expect( [ ...UI_VARS ].sort() ).toEqual( declaredInPalette().sort() );
	} );

	it( 'has no duplicates and a dark family', () => {
		expect( new Set( UI_VARS ).size ).toBe( UI_VARS.length );
		expect( UI_DARK_VARS ).toEqual( expect.arrayContaining( [ '--bl-ui-dark-canvas', '--bl-ui-dark-fg', '--bl-ui-dark-border' ] ) );
		expect( UI_DARK_VARS.every( ( n ) => UI_VARS.includes( n ) ) ).toBe( true );
		expect( Object.isFrozen( UI_VARS ) && Object.isFrozen( UI_DARK_VARS ) ).toBe( true );
	} );

	it( 'is emitted on the admin and inspector roots', () => {
		expect( read( '../admin/styles/_blueprint.scss' ) ).toContain( '@include ui-tokens.palette' );
		expect( read( './inspector/_inspector-foundation.scss' ) ).toContain( '@include ui-tokens.palette' );
	} );
} );
