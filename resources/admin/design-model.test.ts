import { describe, expect, it } from 'vitest';
import { DESIGN_SECTION_IDS, designChanges, designNav, isOwnToken, resolveSection, sectionDirty, sectionForCategory, tokenKeys } from './design-model';
import { FALLBACK_SNAPSHOT } from './fallbacks';
import { TOKEN_CATEGORY_KEYS } from './constants';
import type { DesignSystemSnapshot } from './types';

const snapshot = ( overrides: Partial< DesignSystemSnapshot[ 'overrides' ] > = {} ): DesignSystemSnapshot => ( {
	...FALLBACK_SNAPSHOT,
	overrides: { tokens: {}, breakpoints: {}, typeRoles: {}, ...overrides },
} );

describe( 'designChanges', () => {
	it( 'counts only what differs from what is saved', () => {
		const saved = snapshot( { tokens: { color: { primary: '#111111', accent: '#222222' } } } );
		const changes = designChanges( saved, {
			tokens: { color: { primary: '#111111', accent: '#333333' } },
			breakpoints: {},
			typeRoles: {},
		} );

		expect( changes.map( change => change.key ) ).toEqual( [ 't:color:accent' ] );
		expect( changes[ 0 ] ).toMatchObject( { from: '#222222', to: '#333333', saved: '#222222' } );
	} );

	it( 'treats clearing a saved value as a change back to the theme value', () => {
		const saved = snapshot( { tokens: { radius: { md: '1rem' } } } );
		const [ change ] = designChanges( saved, { tokens: {}, breakpoints: {}, typeRoles: {} } );

		expect( change ).toMatchObject( { key: 't:radius:md', from: '1rem', saved: '1rem' } );
		expect( change.to ).toBe( FALLBACK_SNAPSHOT.baseValues.radius.md );
	} );

	it( 'lists text style properties and screen sizes', () => {
		const changes = designChanges( snapshot( { breakpoints: { tablet: 800 } } ), {
			tokens: {},
			breakpoints: { tablet: 900 },
			typeRoles: { h1: { fontWeight: '800' } },
		} );

		expect( changes.map( change => change.key ).sort() ).toEqual( [ 'b:tablet', 'r:h1:fontWeight' ] );
		expect( changes.find( change => change.kind === 'breakpoint' ) ).toMatchObject( { from: '800px', to: '900px', saved: '800' } );
		expect( sectionDirty( changes, [ 'typeRoles' ] ) ).toBe( true );
		expect( sectionDirty( changes, [ 'color' ] ) ).toBe( false );
	} );
} );

describe( 'sections', () => {
	it( 'has one nav entry per section id', () => {
		const ids = designNav().flatMap( group => group.items.map( item => item.id ) );
		expect( ids ).toEqual( [ ...DESIGN_SECTION_IDS ] );
	} );

	it( 'gives every token category a section to be edited in', () => {
		for ( const category of TOKEN_CATEGORY_KEYS ) {
			expect( sectionForCategory( category ), category ).not.toBe( 'themes' );
		}
	} );

	it( 'keeps links minted before the revamp working', () => {
		expect( resolveSection( 'z' ) ).toBe( 'layers' );
		expect( resolveSection( 'sizing' ) ).toBe( 'size' );
		expect( resolveSection( 'motion' ) ).toBe( 'motion' );
		expect( resolveSection( 'nonsense' ) ).toBe( 'color' );
	} );
} );

describe( 'own tokens', () => {
	it( 'lists a token added in the draft after the catalogue', () => {
		const keys = tokenKeys( FALLBACK_SNAPSHOT, { spacing: { gutter: '1.25rem' } }, 'spacing' );
		expect( keys.at( -1 ) ).toBe( 'gutter' );
		expect( isOwnToken( FALLBACK_SNAPSHOT, 'spacing', 'gutter' ) ).toBe( true );
		expect( isOwnToken( FALLBACK_SNAPSHOT, 'spacing', 'md' ) ).toBe( false );
	} );
} );
