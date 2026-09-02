import { describe, it, expect } from 'vitest';
import {
	cleanAttrName,
	cleanAttrValue,
	cleanAttributes,
	isAttrNameInvalid,
	sanitizeCss,
	scopeCss,
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

describe( 'sanitizeCss', () => {
	it( 'strips dangerous constructs and reports them', () => {
		const r = sanitizeCss( 'selector { color: red } </style><script>x</script>' );
		expect( r.css ).not.toContain( '<' );
		expect( r.blocked ).toContain( '<' );

		expect( sanitizeCss( '@import url(evil.css); selector{}' ).blocked ).toContain( '@import' );
		expect( sanitizeCss( 'selector{width:expression(alert(1))}' ).blocked ).toContain( 'expression()' );
		expect( sanitizeCss( 'selector{background:url(javascript:x)}' ).blocked ).toContain( 'javascript:/vbscript:' );
		expect( sanitizeCss( 'selector{background:url(image.jpg)}' ).blocked ).toContain( 'url()' );
		expect( sanitizeCss( '@charset "UTF-8"; selector{}' ).blocked ).toContain( '@charset/@namespace' );
		expect( sanitizeCss( 'selector{behavior:url(x.htc)}' ).blocked ).toContain( 'behavior/-moz-binding' );
	} );

	it( 'leaves safe CSS (incl. child combinator) intact', () => {
		const r = sanitizeCss( 'selector > * { gap: 8px }' );
		expect( r.css ).toBe( 'selector > * { gap: 8px }' );
		expect( r.blocked ).toEqual( [] );
	} );
} );

describe( 'scopeCss', () => {
	it( 'scopes the selector keyword to the instance', () => {
		expect( scopeCss( 'selector { color: red }', 'abc' ) ).toBe( '.bl-abc { color: red }' );
		expect( scopeCss( 'selector:hover { color: red }', 'abc' ) ).toBe( '.bl-abc:hover { color: red }' );
	} );

	it( 'returns empty without a scope id or content', () => {
		expect( scopeCss( 'selector{}', '' ) ).toBe( '' );
		expect( scopeCss( '', 'abc' ) ).toBe( '' );
	} );
} );
