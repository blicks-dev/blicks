/**
 * @vitest-environment jsdom
 *
 * The registry exposes itself on `window`, which is the whole point of it — a companion plugin
 * is bundled separately and has no import path into this build.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	exposeRegistry,
	getRegisteredView,
	getRegisteredViews,
	registerView,
	resetViews,
	subscribeToViews,
	unregisterView,
} from './registry';

const panel = () => null as unknown as JSX.Element;

describe( 'admin view registry', () => {
	beforeEach( () => {
		resetViews();
		delete ( window as unknown as { blicks?: unknown } ).blicks;
	} );

	it( 'registers a view and hands its component back', () => {
		expect( registerView( { id: 'pro/license', render: panel } ) ).toBe( true );

		expect( getRegisteredView( 'pro/license' )?.id ).toBe( 'pro/license' );
		expect( getRegisteredViews() ).toHaveLength( 1 );
	} );

	/**
	 * The race the store exists for. `app.tsx` mounts before any dependent bundle has run, so a
	 * registration that arrives afterwards has to reach a component that already rendered.
	 */
	it( 'notifies subscribers when a view arrives after the first render', () => {
		const listener = vi.fn();
		subscribeToViews( listener );

		registerView( { id: 'pro/license', render: panel } );

		expect( listener ).toHaveBeenCalledTimes( 1 );
		expect( getRegisteredViews() ).toHaveLength( 1 );
	} );

	/** `useSyncExternalStore` compares by identity — a fresh array each call would loop forever. */
	it( 'returns a stable snapshot until something changes', () => {
		registerView( { id: 'pro/license', render: panel } );

		const first = getRegisteredViews();
		expect( getRegisteredViews() ).toBe( first );

		registerView( { id: 'pro/other', render: panel } );
		expect( getRegisteredViews() ).not.toBe( first );
	} );

	it( 'stops notifying once unsubscribed', () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToViews( listener );

		unsubscribe();
		registerView( { id: 'pro/license', render: panel } );

		expect( listener ).not.toHaveBeenCalled();
	} );

	it( 'replaces a view registered twice rather than duplicating it', () => {
		registerView( { id: 'pro/license', render: panel } );
		registerView( { id: 'pro/license', render: panel } );

		expect( getRegisteredViews() ).toHaveLength( 1 );
	} );

	it( 'removes a view on unregister, and ignores an unknown id', () => {
		const listener = vi.fn();
		registerView( { id: 'pro/license', render: panel } );
		subscribeToViews( listener );

		unregisterView( 'pro/license' );
		expect( getRegisteredViews() ).toHaveLength( 0 );

		unregisterView( 'never-registered' );
		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * This runs inside another plugin's bundle. Throwing would take the whole Blicks admin down
	 * with it, so a bad definition must cost only its own page.
	 */
	describe( 'refuses an unusable definition without throwing', () => {
		const cases: Array< [ string, unknown ] > = [
			[ 'undefined', undefined ],
			[ 'null', null ],
			[ 'a string', 'pro/license' ],
			[ 'no id', { render: panel } ],
			[ 'empty id', { id: '   ', render: panel } ],
			[ 'no render', { id: 'pro/license' } ],
			[ 'render not callable', { id: 'pro/license', render: 'nope' } ],
		];

		it.each( cases )( '%s', ( _label, definition ) => {
			const error = vi.spyOn( console, 'error' ).mockImplementation( () => undefined );

			expect( registerView( definition ) ).toBe( false );
			expect( getRegisteredViews() ).toHaveLength( 0 );

			error.mockRestore();
		} );
	} );

	it( 'exposes the registry on window for separately-bundled plugins', () => {
		exposeRegistry();

		const api = ( window as unknown as {
			blicks: { admin: { registerView: ( d: unknown ) => boolean } };
		} ).blicks.admin;

		expect( api.registerView( { id: 'pro/license', render: panel } ) ).toBe( true );
		expect( getRegisteredView( 'pro/license' ) ).toBeDefined();
	} );

	it( 'does not clobber an existing window.blicks namespace', () => {
		( window as unknown as { blicks: Record< string, unknown > } ).blicks = { somethingElse: 1 };

		exposeRegistry();

		const globalScope = window as unknown as { blicks: Record< string, unknown > };
		expect( globalScope.blicks.somethingElse ).toBe( 1 );
		expect( globalScope.blicks.admin ).toBeDefined();
	} );
} );
