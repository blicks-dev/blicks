import { describe, expect, it } from 'vitest';
import { outlineWarning, setHeadingAlignment, slugOf, typingSlug } from './controls';

const row = ( level: number, me = false ) => ( { level, text: '', me } );

describe( 'Heading', () => {
	it( 'makes an anchor from the words', () => {
		expect( slugOf( 'Three <em>slow</em> days in Lisbon!' ) ).toBe( 'three-slow-days-in-lisbon' );
		expect( slugOf( 'Café & crème' ) ).toBe( 'cafe-creme' );
	} );

	it( 'keeps the dash while an anchor is typed, so it can take a second word', () => {
		expect( typingSlug( 'getting ' ) ).toBe( 'getting-' );
		expect( typingSlug( 'getting-' ) ).toBe( 'getting-' );
		expect( typingSlug( 'getting-a' ) ).toBe( 'getting-a' );
		expect( typingSlug( '-' ) ).toBe( '' );
	} );

	it( 'warns about a skipped level and a second H1, and is quiet otherwise', () => {
		expect( outlineWarning( [ row( 1 ), row( 2 ), row( 3, true ) ] ) ).toBe( '' );
		expect( outlineWarning( [ row( 1 ), row( 4, true ) ] ) ).toMatch( /H1 to H4/ );
		expect( outlineWarning( [ row( 1 ), row( 1, true ) ] ) ).toMatch( /already has an H1/ );
	} );
} );

describe( 'Heading line up', () => {
	it( 'stores left as no value, like Text', () => {
		const set = ( align: string ) => {
			let out: any;
			setHeadingAlignment( { blicks: { 'typography.textAlign': { default: { base: 'center' } } } }, ( a ) => { out = a; }, align );
			return out.blicks[ 'typography.textAlign' ];
		};
		expect( set( 'right' ) ).toEqual( { default: { base: 'right' } } );
		expect( set( 'left' ) ).toBeUndefined();
	} );
} );
