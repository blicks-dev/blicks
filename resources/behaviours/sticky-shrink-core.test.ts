/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import * as core from './sticky-shrink-core';

describe( 'sticky shrink', () => {
	it( 'marks the element past its point, and unmarks it back above', () => {
		const el = document.createElement( 'header' );
		core.update( el, 0 );
		expect( el.hasAttribute( 'data-bl-scrolled' ) ).toBe( false );
		core.update( el, core.DEFAULT_AFTER + 1 );
		expect( el.hasAttribute( 'data-bl-scrolled' ) ).toBe( true );
		el.setAttribute( 'data-bl-after', '200' );
		core.update( el, 100 );
		expect( el.hasAttribute( 'data-bl-scrolled' ) ).toBe( false );
	} );

	it( 'reads the scroll position once per frame', () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal( 'requestAnimationFrame', ( fn: FrameRequestCallback ) => frames.push( fn ) );
		const el = document.createElement( 'header' );
		core.scrolled( el );
		core.scrolled( el );
		expect( frames ).toHaveLength( 1 );
		Object.defineProperty( window, 'scrollY', { configurable: true, value: 50 } );
		frames[ 0 ]( 0 );
		expect( el.hasAttribute( 'data-bl-scrolled' ) ).toBe( true );
		vi.unstubAllGlobals();
	} );

	it( 'hides on the way down past its point, and shows on any move up', () => {
		const el = document.createElement( 'header' );
		el.setAttribute( 'data-bl-hide', '' );
		document.body.append( el );
		const hidden = () => el.hasAttribute( 'data-bl-hidden' );

		core.update( el, 0 );
		core.update( el, 60 );
		expect( hidden() ).toBe( false ); // not yet past HIDE_AFTER
		core.update( el, 200 );
		expect( hidden() ).toBe( true );
		core.update( el, 195 );
		expect( hidden() ).toBe( true ); // a move of HIDE_MOVE or less does not count
		core.update( el, 190 );
		expect( hidden() ).toBe( false );
		core.update( el, 400 );
		expect( hidden() ).toBe( true );

		// Focus inside keeps it, and brings it back.
		const link = document.createElement( 'a' );
		link.href = '/';
		el.append( link );
		link.focus();
		core.focused( el );
		expect( hidden() ).toBe( false );
		core.update( el, 600 );
		expect( hidden() ).toBe( false );
		el.remove();
	} );

	it( 'never hides without opting in', () => {
		const el = document.createElement( 'header' );
		core.update( el, 0 );
		core.update( el, 500 );
		expect( el.hasAttribute( 'data-bl-hidden' ) ).toBe( false );
	} );
} );
