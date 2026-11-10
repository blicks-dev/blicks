import { describe, expect, it } from 'vitest';
import { EMPTY_LOOK } from './style-model';
import { barOf, padFor, roleOf, roomOf } from './TypeStyle';

describe( 'colour behind the words and the accent line share the padding', () => {
	it( 'adds the line’s room to the colour’s', () => {
		expect( padFor( 'snug', '' ) ).toEqual( [ 4, 8, 4, 8 ] );
		expect( padFor( 'snug', 'left' ) ).toEqual( [ 4, 8, 4, 16 ] );
		expect( padFor( '', 'under' ) ).toEqual( [ 0, 0, 10, 0 ] );
		expect( padFor( '', '' ) ).toBe( '' );
	} );

	it( 'reads both back', () => {
		const look = { ...EMPTY_LOOK, pad: [ 10, 16, 10, 16 ], border: { w: 3, style: 'solid' as const, sides: 'left' as const } };
		expect( roomOf( look ) ).toBe( 'roomy' );
		expect( barOf( look ) ).toBe( 'left' );
	} );
} );

describe( 'the role a Size slider starts from', () => {
	const role = ( base: string ) => ( { 'typography.role': { default: { base } } } );
	it( 'follows Looks like, then the level', () => {
		expect( roleOf( { level: 4 }, 'heading' ) ).toBe( 'h4' );
		expect( roleOf( { level: 4, blicks: role( 'display' ) }, 'heading' ) ).toBe( 'display' );
		expect( roleOf( {}, 'heading' ) ).toBe( 'h2' );
	} );
	it( 'reads a Text’s kind and the old Lead variant', () => {
		expect( roleOf( {}, 'text' ) ).toBe( 'body' );
		expect( roleOf( { variant: 'lead' }, 'text' ) ).toBe( 'lead' );
		expect( roleOf( { blicks: role( 'caption' ) }, 'text' ) ).toBe( 'caption' );
	} );
} );
