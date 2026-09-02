import { afterEach, describe, expect, it, vi } from 'vitest';
import { lengthOrTokenPattern, resolveTokenValues, tokenOptions, tokenSuggestions } from './token-utils';

const LENGTH_PATTERN = /^(auto|0|-?\d+(\.\d+)?(px|%|em|rem|vh|vw|fr))$/;

describe( 'tokenOptions', () => {
	it( 'maps catalogue slugs to labelled var() options', () => {
		const radius = tokenOptions( 'radius' );
		expect( radius.map( option => option.slug ) ).toEqual( [ 'none', 'sm', 'md', 'lg', 'xl', 'full' ] );
		expect( radius.find( option => option.slug === 'md' ) ).toEqual( {
			slug: 'md',
			label: 'Md',
			varName: '--blicks-radius-md',
			css: 'var(--blicks-radius-md)',
		} );
	} );

	it( 'covers the full color catalogue', () => {
		const colors = tokenOptions( 'color' );
		expect( colors ).toHaveLength( 18 );
		expect( colors.find( option => option.slug === 'card-foreground' )?.label ).toBe( 'Card Foreground' );
	} );
} );

describe( 'lengthOrTokenPattern', () => {
	const spacing = lengthOrTokenPattern( 'spacing', LENGTH_PATTERN );

	it( 'still accepts the base literal pattern', () => {
		for ( const value of [ 'auto', '0', '12px', '-4px', '1.5rem', '50%' ] ) {
			expect( spacing.test( value ), value ).toBe( true );
		}
	} );

	it( 'accepts the category token slugs', () => {
		for ( const value of [ 'xs', 'md', '2xl', '4xl', 'px' ] ) {
			expect( spacing.test( value ), value ).toBe( true );
		}
	} );

	it( 'rejects unknown words and other-category slugs', () => {
		expect( spacing.test( 'bogus' ) ).toBe( false );
		expect( spacing.test( 'full' ) ).toBe( false ); // radius-only slug
		expect( lengthOrTokenPattern( 'radius', LENGTH_PATTERN ).test( 'full' ) ).toBe( true );
	} );
} );

describe( 'tokenSuggestions', () => {
	it( 'prepends token slugs and dedupes against extras', () => {
		const suggestions = tokenSuggestions( 'spacing', [ '0', '8px', '1rem' ] );
		expect( suggestions[ 0 ] ).toBe( '0' );
		expect( suggestions.filter( value => value === '0' ) ).toHaveLength( 1 );
		expect( suggestions ).toContain( 'md' );
		expect( suggestions ).toContain( '8px' );
	} );
} );

describe( 'resolveTokenValues', () => {
	it( 'returns an empty map without a DOM', () => {
		expect( resolveTokenValues( 'color' ) ).toEqual( {} );
	} );
} );

describe( 'live token catalogue bridge', () => {
	afterEach( () => {
		vi.unstubAllGlobals();
		vi.resetModules();
	} );

	it( 'falls back to the static catalogue when the bridge is absent', async () => {
		vi.stubGlobal( 'window', {} );
		const fresh = await import( './token-utils' );
		expect( fresh.tokenOptions( 'spacing' ).map( option => option.slug ) ).toEqual(
			tokenOptions( 'spacing' ).map( option => option.slug )
		);
	} );

	it( 'prefers the live bridge scale when present', async () => {
		vi.stubGlobal( 'window', {
			blicksEditorSettings: {
				tokenCatalogue: {
					spacing: [
						{ slug: 'tight', name: 'Tight', value: '4px' },
						{ slug: 'roomy', name: 'Roomy', value: '32px' },
					],
				},
			},
		} );

		const fresh = await import( './token-utils' );
		expect( fresh.tokenOptions( 'spacing' ).map( option => option.slug ) ).toEqual( [ 'tight', 'roomy' ] );
		expect( fresh.tokenSuggestions( 'spacing' ) ).toEqual( [ 'tight', 'roomy' ] );
		expect( fresh.lengthOrTokenPattern( 'spacing', LENGTH_PATTERN ).test( 'tight' ) ).toBe( true );
		expect( fresh.lengthOrTokenPattern( 'spacing', LENGTH_PATTERN ).test( 'md' ) ).toBe( false );
	} );

	it( 'falls back to the static catalogue for a category the bridge omits', async () => {
		vi.stubGlobal( 'window', {
			blicksEditorSettings: { tokenCatalogue: { spacing: [ { slug: 'tight', name: 'Tight', value: '4px' } ] } },
		} );
		const fresh = await import( './token-utils' );
		expect( fresh.tokenOptions( 'radius' ).map( option => option.slug ) ).toEqual(
			tokenOptions( 'radius' ).map( option => option.slug )
		);
	} );
} );
