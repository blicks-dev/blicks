// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { actionFor, clickKind, widthChoice, withWidth } from './controls';

describe( 'Button width: Fit, Fill or Fixed', () => {
	it( 'reads Fill from the attribute, Fixed from a base width, and leaves the old Wide unmatched', () => {
		expect( widthChoice( {} ) ).toBe( 'fit' );
		expect( widthChoice( { width: 'full' } ) ).toBe( 'fill' );
		expect( widthChoice( { blicks: { 'layout.width': { default: { base: '200px' } } } } ) ).toBe( 'fixed' );
		expect( widthChoice( { width: 'wide' } ) ).toBeNull();
	} );

	it( 'writes Fixed as a width, starting at 12rem, and clears it for Fit and Fill', () => {
		const fixed = withWidth( { width: 'wide' }, 'fixed' );
		expect( fixed.width ).toBe( '' );
		expect( fixed.blicks[ 'layout.width' ] ).toEqual( { default: { base: '12rem' } } );
		expect( withWidth( { blicks: fixed.blicks }, 'fixed', '240px' ).blicks[ 'layout.width' ] ).toEqual( { default: { base: '240px' } } );
		const fill = withWidth( { blicks: fixed.blicks }, 'fill' );
		expect( fill.width ).toBe( 'full' );
		expect( fill.blicks[ 'layout.width' ] ).toBeUndefined();
		expect( withWidth( { blicks: fixed.blicks }, 'fit' ) ).toEqual( { width: '', blicks: {} } );
	} );
} );

describe( 'Button On click in three', () => {
	it( 'groups the five actions under Link, Dialog and Form', () => {
		expect( clickKind( 'link' ) ).toBe( 'link' );
		expect( clickKind( 'dialog' ) ).toBe( 'dialog' );
		expect( clickKind( 'close' ) ).toBe( 'dialog' );
		expect( clickKind( 'submit' ) ).toBe( 'form' );
		expect( clickKind( 'reset' ) ).toBe( 'form' );
	} );

	it( 'starts a kind at its first action and keeps one already picked', () => {
		expect( actionFor( 'dialog', 'link' ) ).toBe( 'dialog' );
		expect( actionFor( 'form', 'link' ) ).toBe( 'submit' );
		expect( actionFor( 'form', 'reset' ) ).toBe( 'reset' );
		expect( actionFor( 'dialog', 'close' ) ).toBe( 'close' );
		expect( actionFor( 'link', 'close' ) ).toBe( 'link' );
	} );
} );
