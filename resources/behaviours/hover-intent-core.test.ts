/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from './hover-intent-core';

let el: HTMLElement;
let seen: boolean[];

beforeEach( () => {
	vi.useFakeTimers();
	el = document.createElement( 'div' );
	seen = [];
	el.addEventListener( 'bl-intent', ( e ) => seen.push( ( e as CustomEvent ).detail.on ) );
} );

afterEach( () => vi.useRealTimers() );

const mouse = { pointerType: 'mouse' };

describe( 'hover intent', () => {
	it( 'reads its delay, within bounds', () => {
		expect( core.delayOf( el ) ).toBe( core.DEFAULT_DELAY );
		el.setAttribute( 'data-bl-delay', '0' );
		expect( core.delayOf( el ) ).toBe( 0 );
		el.setAttribute( 'data-bl-delay', '9000' );
		expect( core.delayOf( el ) ).toBe( 2000 );
		el.setAttribute( 'data-bl-delay', 'soon' );
		expect( core.delayOf( el ) ).toBe( core.DEFAULT_DELAY );
	} );

	it( 'fires once the pointer has rested, not when it only crosses', () => {
		core.entered( el, mouse );
		vi.advanceTimersByTime( 100 );
		core.left( el, mouse );
		vi.advanceTimersByTime( 1000 );
		expect( seen ).toEqual( [] );

		core.entered( el, mouse );
		vi.advanceTimersByTime( 150 );
		expect( seen ).toEqual( [ true ] );
	} );

	it( 'waits a grace period before leaving, and a return cancels it', () => {
		core.entered( el, mouse );
		vi.advanceTimersByTime( 150 );
		core.left( el, mouse );
		vi.advanceTimersByTime( 200 );
		core.entered( el, mouse );
		vi.advanceTimersByTime( 1000 );
		expect( seen ).toEqual( [ true ] );

		core.left( el, mouse );
		vi.advanceTimersByTime( core.LEAVE_GRACE );
		expect( seen ).toEqual( [ true, false ] );
	} );

	it( 'ignores touch and pen', () => {
		core.entered( el, { pointerType: 'touch' } );
		core.entered( el, { pointerType: 'pen' } );
		vi.advanceTimersByTime( 1000 );
		expect( seen ).toEqual( [] );
	} );
} );
