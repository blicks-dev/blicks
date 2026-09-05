import { describe, expect, it } from 'vitest';
import { STYLE_MAP } from '@/framework/css/vars';
import {
	PROPERTY_MAP,
	normalizeProperty,
	classifyDeclaration,
	analyzeDeclarations,
	parseDeclarations,
} from './css-coverage';

describe( 'css-coverage', () => {
	it( 'classifies a mapped property to its control section + attr', () => {
		expect( classifyDeclaration( 'padding', '16px' ) ).toEqual( {
			property: 'padding',
			value: '16px',
			kind: 'control',
			section: 'spacing',
			attr: 'spacing.padding',
		} );
		expect( classifyDeclaration( 'font-size', '1rem' ).kind ).toBe( 'control' );
		expect( classifyDeclaration( 'clip-path', 'circle(50%)' ) ).toMatchObject( { section: 'effects', attr: 'effects.clipPath' } );
	} );

	it( 'classifies an uncovered property as custom (no matching control)', () => {
		expect( classifyDeclaration( 'caret-color', 'red' ).kind ).toBe( 'custom' );
		expect( classifyDeclaration( 'hyphens', 'auto' ).kind ).toBe( 'custom' );
	} );

	it( 'classifies -webkit-line-clamp as a covered layout control (Wave H)', () => {
		expect( classifyDeclaration( '-webkit-line-clamp', '3' ) ).toMatchObject( { section: 'layout', attr: 'layout.lineClamp' } );
	} );

	it( 'normalizes longhand / side / corner properties to the controlled base', () => {
		expect( normalizeProperty( 'padding-top' ) ).toBe( 'padding' );
		expect( normalizeProperty( 'margin-left' ) ).toBe( 'margin' );
		expect( normalizeProperty( 'top' ) ).toBe( 'inset' );
		expect( normalizeProperty( 'border-top-left-radius' ) ).toBe( 'border-radius' );
		expect( normalizeProperty( 'border-bottom-color' ) ).toBe( 'border-color' );
		// longhands resolve to a control:
		expect( classifyDeclaration( 'padding-top', '8px' ).kind ).toBe( 'control' );
		expect( classifyDeclaration( 'left', '0' ).kind ).toBe( 'control' );
	} );

	it( 'parses a declaration block and reports coverage', () => {
		const decls = parseDeclarations( 'display: flex; gap: 1rem; caret-color: red; padding: 8px' );
		expect( decls ).toHaveLength( 4 );
		const report = analyzeDeclarations( decls );
		expect( report.summary.total ).toBe( 4 );
		expect( report.summary.controlled ).toBe( 3 );
		expect( report.summary.custom ).toBe( 1 );
		expect( report.custom[ 0 ].property ).toBe( 'caret-color' );
		expect( report.summary.coverage ).toBe( 0.75 );
	} );

	// Drift guard: every STYLE_MAP attr's section must be represented in PROPERTY_MAP (decoration is
	// the documented exception — it's ::before/::after, not a single CSS property). If a new section
	// lands in STYLE_MAP, this fails until the coverage map is updated.
	it( 'covers every STYLE_MAP section', () => {
		const mappedSections = new Set( Object.values( PROPERTY_MAP ).map( ( r ) => r.section ) );
		for ( const rule of STYLE_MAP ) {
			const section = rule.attr.split( '.' )[ 0 ];
			if ( section === 'decoration' ) {
				continue; // ::before/::after — handled by the decoration control, not a property map
			}
			expect( mappedSections.has( section as any ) ).toBe( true );
		}
	} );
} );
