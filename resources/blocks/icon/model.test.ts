import { describe, expect, it } from 'vitest';
import { cleanTurn, iconClasses } from './model';

describe( 'icon flip and turn', () => {
	it( 'writes no class for an icon drawn as it comes', () => {
		expect( iconClasses( {} ) ).toEqual( [] );
		expect( iconClasses( { flipH: false, flipV: false, turn: 0 } ) ).toEqual( [] );
	} );

	it( 'writes a class per mirror and the quarter turn', () => {
		expect( iconClasses( { flipH: true, flipV: true, turn: 90 } ) ).toEqual( [ 'bl-icon--flip-h', 'bl-icon--flip-v', 'bl-icon--turn-90' ] );
		expect( iconClasses( { filled: true } ) ).toEqual( [ 'bl-icon--filled' ] );
	} );

	it( 'keeps only quarter turns', () => {
		expect( cleanTurn( 180 ) ).toBe( 180 );
		expect( cleanTurn( 45 ) ).toBe( 0 );
		expect( cleanTurn( '270' ) ).toBe( 270 );
		expect( cleanTurn( 'x' ) ).toBe( 0 );
	} );
} );
