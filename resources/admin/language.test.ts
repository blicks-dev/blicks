import { describe, expect, it } from 'vitest';
import { languageVars } from './language';

const color = ( slug: string ) => ( { primary: '#4f46e5', foreground: '#09090b' } as Record< string, string > )[ slug ] ?? '';

describe( 'languageVars', () => {
	it( 'resolves palette colours in component values', () => {
		const vars = languageVars( { 'button-border-color': 'color-mix(in srgb, {color.primary} 65%, #000)' }, color, false );
		expect( vars ).toEqual( { '--lk-btn-border': 'color-mix(in srgb, #4f46e5 65%, #000)' } );
	} );

	it( 'draws the base only for a language the page does not hold', () => {
		const sample = { radius: '0', cardRadius: '0', shadow: '3px 3px 0 #09090b', headingSerif: '1', 'button-border-color': '{color.foreground}' };
		expect( languageVars( sample, color, false ) ).not.toHaveProperty( '--r-md' );
		const full = languageVars( sample, color, true );
		expect( full[ '--r-md' ] ).toBe( '0' );
		expect( full[ '--sh-sm' ] ).toBe( '3px 3px 0 #09090b' );
		expect( full[ '--t-h1-family' ] ).toContain( 'serif' );
		expect( full[ '--lk-btn-border' ] ).toBe( '#09090b' );
	} );

	it( 'frosts and edges cards, and draws the colors a language sets', () => {
		const vars = languageVars( { 'surface-opacity': '45%', 'surface-border-color': 'rgb(255 255 255 / 0.6)', 'color.background': '#e7ecf2' }, color, true );
		expect( vars[ '--lk-card-opacity' ] ).toBe( '45%' );
		expect( vars[ '--lk-card-border' ] ).toBe( 'rgb(255 255 255 / 0.6)' );
		expect( vars[ '--c-background' ] ).toBe( '#e7ecf2' );
		expect( languageVars( { 'color.background': '#e7ecf2' }, color, false ) ).not.toHaveProperty( '--c-background' );
	} );

	it( 'puts the heading face back for another language, and keeps a plain backdrop plain', () => {
		expect( languageVars( {}, color, true )[ '--t-h1-family' ] ).toBe( 'inherit' );
		expect( languageVars( { backdrop: 'plain' }, color, false )[ '--lk-backdrop' ] ).toBe( 'var(--c-background)' );
	} );

	it( 'leaves out what the chosen language does not set', () => {
		expect( languageVars( {}, color, false ) ).toEqual( {} );
	} );
} );
