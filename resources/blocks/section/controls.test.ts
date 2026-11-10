import { describe, expect, it } from 'vitest';
import metadata from './block.json';
import { readArrange } from '@/blocks/box/model';
import { SECTION_DEFAULTS, cleanSectionDimension, cleanSectionSpace, cleanSectionSurface, describeSection, isSectionDimension } from './model';
import { copyStack, heroStack } from './presets';

describe( 'Section settings', () => {
	it( 'keeps the attribute defaults block.json declares', () => {
		for ( const [ key, value ] of Object.entries( SECTION_DEFAULTS ) ) {
			expect( ( metadata.attributes as any )[ key ].default ).toBe( value );
		}
	} );

	it( 'falls back to plain and medium for an unknown surface or space', () => {
		expect( cleanSectionSurface( 'muted' ) ).toBe( 'muted' );
		expect( cleanSectionSurface( 'neon' ) ).toBe( 'plain' );
		expect( cleanSectionSurface( undefined ) ).toBe( 'plain' );
		expect( cleanSectionSpace( 'lg' ) ).toBe( 'lg' );
		expect( cleanSectionSpace( 'xxl' ) ).toBe( 'md' );
	} );

	it( 'cleans a size the way the PHP render does', () => {
		expect( cleanSectionDimension( '', 'auto' ) ).toBe( 'auto' );
		expect( cleanSectionDimension( '640', 'auto' ) ).toBe( '640px' );
		expect( cleanSectionDimension( '80vh', 'auto' ) ).toBe( '80vh' );
		expect( cleanSectionDimension( 'clamp(320px, 50vw, 900px)', 'auto' ) ).toBe( 'clamp(320px, 50vw, 900px)' );
		expect( cleanSectionDimension( SECTION_DEFAULTS.contentMaxWidth, 'none' ) ).toBe( SECTION_DEFAULTS.contentMaxWidth );
		expect( cleanSectionDimension( 'calc(100% - 2rem', 'auto' ) ).toBe( 'auto' );
		expect( cleanSectionDimension( 'wide', '100%' ) ).toBe( '100%' );
	} );

	it( 'accepts a typed size only when it is one', () => {
		expect( isSectionDimension( '100svh' ) ).toBe( true );
		expect( isSectionDimension( '640' ) ).toBe( true );
		expect( isSectionDimension( 'fit-content' ) ).toBe( true );
		expect( isSectionDimension( 'min(90%, 1200px)' ) ).toBe( true );
		expect( isSectionDimension( '' ) ).toBe( false );
		expect( isSectionDimension( '12 px' ) ).toBe( false );
		expect( isSectionDimension( 'big' ) ).toBe( false );
	} );

	it( 'names the band by its surface', () => {
		expect( describeSection( { surface: 'muted' } ) ).toBe( 'Muted band' );
		expect( describeSection( {} ) ).toBe( 'Plain band' );
	} );
} );

describe( 'Section starting layouts', () => {
	it( 'stack in a Box that reads back as Stacked, not custom', () => {
		const copy = readArrange( copyStack(), false );
		expect( copy.arrangement ).toBe( 'stack' );
		expect( copy.options.stretch ).toBe( 'yes' );

		const hero = readArrange( heroStack(), false );
		expect( hero.arrangement ).toBe( 'stack' );
		expect( [ hero.options.x, hero.options.y ] ).toEqual( [ 'center', 'center' ] );
		expect( heroStack()[ 'layout.alignItems' ] ).toEqual( { default: { base: 'center' } } );
	} );
} );
