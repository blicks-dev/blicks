import { describe, it, expect } from 'vitest';
import {
	cleanAttrName,
	cleanAttrValue,
	cleanAttributes,
	isAttrNameInvalid,
} from './sanitize';

// Parity mirror: tests/Unit/Style/SanitizeTest.php must assert the same cases.

describe( 'cleanAttrName', () => {
	it( 'accepts the allow-list (normalised lowercase)', () => {
		expect( cleanAttrName( 'data-x' ) ).toBe( 'data-x' );
		expect( cleanAttrName( 'DATA-Foo-1' ) ).toBe( 'data-foo-1' );
		expect( cleanAttrName( 'aria-label' ) ).toBe( 'aria-label' );
		expect( cleanAttrName( ' role ' ) ).toBe( 'role' );
		expect( cleanAttrName( 'id' ) ).toBe( 'id' );
	} );

	it( 'rejects everything else', () => {
		expect( cleanAttrName( 'onclick' ) ).toBeNull();
		expect( cleanAttrName( 'style' ) ).toBeNull();
		expect( cleanAttrName( 'class' ) ).toBeNull();
		expect( cleanAttrName( 'href' ) ).toBeNull();
		expect( cleanAttrName( 'data-' ) ).toBeNull();
		expect( cleanAttrName( '' ) ).toBeNull();
	} );
} );

describe( 'cleanAttrValue', () => {
	it( 'strips control chars + script schemes and trims', () => {
		expect( cleanAttrValue( '  hello  ' ) ).toBe( 'hello' );
		expect( cleanAttrValue( 'a\0b\x1Fc' ) ).toBe( 'abc' );
		expect( cleanAttrValue( 'javascript:alert(1)' ) ).toBe( 'alert(1)' );
		expect( cleanAttrValue( 'VBScript:x' ) ).toBe( 'x' );
	} );

	it( 'caps length at 500', () => {
		expect( cleanAttrValue( 'a'.repeat( 600 ) ).length ).toBe( 500 );
	} );
} );

describe( 'cleanAttributes', () => {
	it( 'keeps valid rows, drops invalid, last write wins per name', () => {
		expect(
			cleanAttributes( [
				{ name: 'data-x', value: '1' },
				{ name: 'onclick', value: 'evil' },
				{ name: 'data-x', value: '2' },
				{ name: 'aria-hidden', value: 'true' },
			] )
		).toEqual( [
			{ name: 'data-x', value: '2' },
			{ name: 'aria-hidden', value: 'true' },
		] );
	} );

	it( 'returns [] for non-arrays', () => {
		expect( cleanAttributes( undefined ) ).toEqual( [] );
		expect( cleanAttributes( 'x' ) ).toEqual( [] );
	} );
} );

describe( 'isAttrNameInvalid', () => {
	it( 'is false for empty/valid, true for non-empty invalid', () => {
		expect( isAttrNameInvalid( '' ) ).toBe( false );
		expect( isAttrNameInvalid( 'data-x' ) ).toBe( false );
		expect( isAttrNameInvalid( 'onclick' ) ).toBe( true );
	} );
} );
