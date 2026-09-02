import { describe, expect, it } from 'vitest';
import { DEFAULT_PICKER_COLOR, hex8ToValue, parseHex, pickerColorOf, toRgba } from './color-value';

describe( 'parseHex', () => {
	it( 'reads a six-digit hex', () => {
		expect( parseHex( '#3858e9' ) ).toEqual( { r: 0x38, g: 0x58, b: 0xe9 } );
	} );

	it( 'expands a three-digit hex', () => {
		expect( parseHex( '#f0a' ) ).toEqual( { r: 255, g: 0, b: 170 } );
	} );

	it( 'does not require the hash', () => {
		expect( parseHex( '3858e9' ) ).toEqual( parseHex( '#3858e9' ) );
	} );
} );

describe( 'toRgba', () => {
	it( 'writes the alpha through', () => {
		expect( toRgba( '#ff0000', 0.5 ) ).toBe( 'rgba(255, 0, 0, 0.5)' );
	} );
} );

describe( 'hex8ToValue', () => {
	it( 'drops a fully-opaque alpha byte', () => {
		expect( hex8ToValue( '#ff0000ff' ) ).toBe( '#ff0000' );
	} );

	it( 'treats an alpha that rounds to opaque as opaque', () => {
		// 254/255 = 0.996, above the 0.995 threshold — storing rgba() here would put an alpha in
		// the author's CSS that they never asked for.
		expect( hex8ToValue( '#ff0000fe' ) ).toBe( '#ff0000' );
	} );

	it( 'keeps a real alpha as rgba', () => {
		expect( hex8ToValue( '#ff000080' ) ).toBe( 'rgba(255, 0, 0, 0.5)' );
	} );

	it( 'rounds the alpha to two places rather than carrying float noise', () => {
		expect( hex8ToValue( '#00000033' ) ).toBe( 'rgba(0, 0, 0, 0.2)' );
	} );

	it( 'passes non-hex8 values through untouched', () => {
		for ( const value of [ '#ff0000', 'rgba(1, 2, 3, 0.4)', 'primary', 'var(--blicks-color-primary)', '' ] ) {
			expect( hex8ToValue( value ) ).toBe( value );
		}
	} );
} );

describe( 'pickerColorOf', () => {
	it( 'opens on the default for an empty value', () => {
		expect( pickerColorOf( '' ) ).toBe( DEFAULT_PICKER_COLOR );
	} );

	it( 'opens on the default for a token or var reference', () => {
		// The caller passes '' for these, but a slug reaching here must not be half-parsed into a
		// colour that misrepresents where the wheel is.
		expect( pickerColorOf( 'primary' ) ).toBe( DEFAULT_PICKER_COLOR );
		expect( pickerColorOf( 'var(--blicks-color-primary)' ) ).toBe( DEFAULT_PICKER_COLOR );
	} );

	it( 'keeps an opaque hex as six digits', () => {
		expect( pickerColorOf( '#12ab34' ) ).toBe( '#12ab34' );
	} );

	it( 'converts rgba to eight-digit hex', () => {
		expect( pickerColorOf( 'rgba(255, 0, 0, 0.5)' ) ).toBe( '#ff000080' );
	} );

	it( 'drops the alpha byte when rgba is fully opaque', () => {
		expect( pickerColorOf( 'rgba(255, 0, 0, 1)' ) ).toBe( '#ff0000' );
	} );

	it( 'pads single-digit channels', () => {
		expect( pickerColorOf( 'rgba(1, 2, 3, 0.5)' ) ).toBe( '#01020380' );
	} );

	it( 'honours an explicit fallback', () => {
		expect( pickerColorOf( '', '#000000' ) ).toBe( '#000000' );
	} );

	it( 'round-trips a value through the picker and back', () => {
		for ( const stored of [ '#ff0000', 'rgba(255, 0, 0, 0.5)', 'rgba(1, 2, 3, 0.2)' ] ) {
			expect( hex8ToValue( pickerColorOf( stored ) ) ).toBe( stored );
		}
	} );
} );
