/**
 * The Form vocabulary in TypeScript (what the editor writes) against `src/Forms/Schema.php` (what
 * the server acts on). A type, width or option added on one side and not the other is a form the
 * editor builds and the server refuses — or the reverse. tests/Unit/Forms/SchemaTest.php pins the
 * PHP side to the MCP serializer's table.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLIENT_TOKENS, FIELD_TYPES, RESERVED_NAMES, WIDTH_SPAN } from './field/model';
import { AFTER_KINDS, CHALLENGES, LABELS, LOOKS, MARKERS } from './form/model';
import { APPEARANCES } from './field/model';
import field from './field/block.json';
import form from './form/block.json';

const php = readFileSync( resolve( __dirname, '../../src/Forms/Schema.php' ), 'utf8' );

/** A `public const NAME = [ 'a', 'b' ];` list from Schema.php. */
function list( name: string ): string[] {
	const match = new RegExp( `const ${ name } = \\[([^\\]]*)\\]` ).exec( php );
	if ( ! match ) throw new Error( `Schema::${ name } not found` );
	return [ ...match[ 1 ].matchAll( /'([^']*)'/g ) ].map( ( m ) => m[ 1 ] );
}

describe( 'Form vocabulary parity, TS ↔ PHP', () => {
	it( 'field types, names and hidden tokens', () => {
		expect( [ ...FIELD_TYPES ] ).toEqual( list( 'TYPES' ) );
		expect( [ ...RESERVED_NAMES ] ).toEqual( list( 'RESERVED' ) );
		expect( [ ...CLIENT_TOKENS ] ).toEqual( list( 'CLIENT_TOKENS' ) );
	} );

	it( 'widths and their spans', () => {
		const body = /const WIDTHS = \[([^\]]*)\]/.exec( php )?.[ 1 ] ?? '';
		const spans = Object.fromEntries( [ ...body.matchAll( /'(\w+)' => (\d+)/g ) ].map( ( m ) => [ m[ 1 ], Number( m[ 2 ] ) ] ) );
		expect( WIDTH_SPAN ).toEqual( spans );
	} );

	it( 'form options', () => {
		expect( [ ...LOOKS ] ).toEqual( list( 'LOOKS' ) );
		expect( [ ...LABELS ] ).toEqual( list( 'LABELS' ) );
		expect( [ ...MARKERS ] ).toEqual( list( 'MARKERS' ) );
		expect( [ ...AFTER_KINDS ] ).toEqual( list( 'AFTER' ) );
		expect( [ ...CHALLENGES ] ).toEqual( list( 'CHALLENGES' ) );
	} );

	it( 'appearances', () => {
		const body = /const APPEARANCES = \[([\s\S]*?)\n\t\];/.exec( php )?.[ 1 ] ?? '';
		const parsed = Object.fromEntries( [ ...body.matchAll( /'(\w+)' => \[([^\]]*)\]/g ) ].map( ( m ) => [ m[ 1 ], [ ...m[ 2 ].matchAll( /'([^']*)'/g ) ].map( ( x ) => x[ 1 ] ) ] ) );
		expect( APPEARANCES ).toEqual( parsed );
	} );

	it( 'block.json defaults are the cleaned defaults', () => {
		expect( field.attributes.type.default ).toBe( FIELD_TYPES[ 0 ] );
		expect( field.attributes.width.default ).toBe( 'full' );
		expect( form.attributes.look.default ).toBe( LOOKS[ 0 ] );
		expect( form.attributes.labels.default ).toBe( LABELS[ 0 ] );
		expect( form.attributes.spam.default.challenge ).toBe( 'none' );
	} );
} );
