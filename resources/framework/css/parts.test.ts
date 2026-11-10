/**
 * The **part** axis — styling a pseudo-element through the ordinary controls.
 *
 * The load-bearing claim is that a part slot changes *only* the scoped CSS: the element's classes
 * and inline vars come out exactly as they would without it, or styling a `::before` would
 * restyle its host. Every case lives in tests/fixtures/part-cases.json, which PartsTest.php runs
 * against the PHP engine too — same inputs, same strings.
 */

import { describe, expect, it } from 'vitest';
import { buildElementStyle } from './vars';
import { parseSlot, slotId, slotSelectorSuffix } from '@/framework/parts';
import fixture from '../../../tests/fixtures/part-cases.json';

describe( 'slot keys', () => {
	it( 'elides both defaults, so element slots keep their plain state key', () => {
		expect( slotId( 'element', 'default' ) ).toBe( 'default' );
		expect( slotId( 'element', 'hover' ) ).toBe( 'hover' );
		expect( slotId( 'before', 'default' ) ).toBe( 'before' );
		expect( slotId( 'after', 'active' ) ).toBe( 'after:active' );
	} );

	it( 'round-trips', () => {
		for ( const part of [ 'element', 'before', 'after' ] ) {
			for ( const state of [ 'default', 'hover', 'focus', 'active' ] ) {
				expect( parseSlot( slotId( part, state ) ) ).toEqual( { part, state } );
			}
		}
	} );

	it( 'reads an unknown slot as the element base state rather than dropping it', () => {
		expect( parseSlot( 'marker' ) ).toEqual( { part: 'element', state: 'default' } );
		expect( parseSlot( 'before:visited' ) ).toEqual( { part: 'before', state: 'default' } );
	} );

	it( 'builds the selector suffix from both halves', () => {
		expect( slotSelectorSuffix( 'default' ) ).toBe( '' );
		expect( slotSelectorSuffix( 'hover' ) ).toBe( ':hover' );
		expect( slotSelectorSuffix( 'before' ) ).toBe( '::before' );
		// State first: Chrome drops `::after:hover` as an invalid selector.
		expect( slotSelectorSuffix( 'after:hover' ) ).toBe( ':hover::after' );
	} );
} );

describe( 'part emission', () => {
	it( 'never puts a pseudo-class after a pseudo-element, which Chrome drops', () => {
		for ( const c of fixture.cases as any[] ) {
			for ( const rule of buildElementStyle( c.blicks, { uniqueId: c.uniqueId } ).scopedCss ?? [] ) {
				expect( rule ).not.toMatch( /::(before|after):/ );
			}
		}
	} );

	for ( const c of fixture.cases as any[] ) {
		it( c.name, () => {
			const out = buildElementStyle( c.blicks, { uniqueId: c.uniqueId } );
			expect( out.scopedCss ?? null ).toEqual( c.scopedCss ?? null );
			if ( c.classes ) expect( out.classes ).toEqual( c.classes );
			if ( c.vars ) expect( out.vars ).toEqual( c.vars );
		} );
	}
} );
