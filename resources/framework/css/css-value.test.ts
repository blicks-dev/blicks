import { describe, expect, it } from 'vitest';
import { cleanCssUrl, cleanCssValue } from './css-value';
import cases from '../../../tests/fixtures/css-value-cases.json';

// Same table as tests/Unit/Style/CssValueTest.php::test_shared_parity_table — the PHP class is the
// front-end gate, this mirror must judge every value identically.
describe( 'cleanCssValue — shared parity table', () => {
	it.each( cases.accept )( 'accepts %s', ( value ) => {
		expect( cleanCssValue( value ) ).toBe( value );
	} );

	it.each( cases.reject )( 'rejects %s', ( value ) => {
		expect( cleanCssValue( value ) ).toBe( '' );
	} );
} );

describe( 'cleanCssUrl — shared parity table', () => {
	it.each( cases.url_accept )( 'accepts %s', ( value ) => {
		expect( cleanCssUrl( value ) ).toBe( value );
	} );

	it.each( cases.url_reject )( 'rejects %s', ( value ) => {
		expect( cleanCssUrl( value ) ).toBe( '' );
	} );
} );

describe( 'cleanCssValue — PHP scalar semantics', () => {
	it( 'rejects non-scalars and over-long values', () => {
		expect( cleanCssValue( null ) ).toBe( '' );
		expect( cleanCssValue( undefined ) ).toBe( '' );
		expect( cleanCssValue( [ '12px' ] ) ).toBe( '' );
		expect( cleanCssValue( { a: 1 } ) ).toBe( '' );
		expect( cleanCssValue( 'a'.repeat( 501 ) ) ).toBe( '' );
	} );

	it( 'casts numbers and trims like PHP', () => {
		expect( cleanCssValue( 12 ) ).toBe( '12' );
		expect( cleanCssValue( '  12px\t' ) ).toBe( '12px' );
	} );
} );
