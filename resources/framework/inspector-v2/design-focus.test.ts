// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_TAB_EVENT, onFocusRequest, requestTab, takeTab } from './design-focus';

describe( 'tab requests', () => {
	afterEach( () => vi.useRealTimers() );

	it( 'reaches the panel for that block once, and tells listeners', () => {
		const heard = vi.fn();
		const stop = onFocusRequest( heard );
		requestTab( 'a', 'quick' );
		stop();

		expect( heard ).toHaveBeenCalledTimes( 1 );
		expect( takeTab( 'b' ) ).toBeNull();
		expect( takeTab( 'a' ) ).toBe( 'quick' );
		expect( takeTab( 'a' ) ).toBeNull();
	} );

	it( 'lapses, so a stale request cannot switch a later panel', () => {
		vi.useFakeTimers();
		requestTab( 'a', 'quick' );
		vi.advanceTimersByTime( 5000 );
		expect( takeTab( 'a' ) ).toBeNull();
	} );
} );

describe( 'the Studio shell hears tab requests', () => {
	it( 'announces each one on window, so the Studio can open its inspector', () => {
		const heard: unknown[] = [];
		const listen = ( e: Event ) => heard.push( ( e as CustomEvent ).detail );
		window.addEventListener( DESIGN_TAB_EVENT, listen );
		requestTab( 'a', 'quick' );
		window.removeEventListener( DESIGN_TAB_EVENT, listen );
		takeTab( 'a' );

		expect( heard ).toEqual( [ { clientId: 'a', tab: 'quick' } ] );
	} );
} );
