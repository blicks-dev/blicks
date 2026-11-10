/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { follow } from './portal-core';

const $ = ( id: string ) => document.getElementById( id ) as HTMLElement;
const event = ( type: string ) => $( 'd' ).dispatchEvent( new CustomEvent( type, { bubbles: true } ) );

beforeEach( () => {
	document.body.innerHTML = '<nav id="n"><button id="b"></button><ul id="l" data-bl-portal="d"><li>A</li></ul><dialog id="d"><button id="c"></button></dialog></nav>';
} );

describe( 'portal', () => {
	it( 'moves into the dialog while it is open, and back to its place', () => {
		follow( $( 'l' ) );
		expect( $( 'l' ).hasAttribute( 'data-bl-portal-ready' ) ).toBe( true );

		event( 'bl:dialog-open' );
		expect( $( 'l' ).parentElement ).toBe( $( 'd' ) );
		expect( $( 'd' ).firstElementChild ).toBe( $( 'c' ) );

		event( 'bl:dialog-close' );
		expect( $( 'l' ).parentElement ).toBe( $( 'n' ) );
		expect( $( 'l' ).previousElementSibling ).toBe( $( 'b' ) );
		expect( $( 'l' ).nextElementSibling ).toBe( $( 'd' ) );
	} );

	it( 'ignores other dialogs', () => {
		follow( $( 'l' ) );
		document.body.insertAdjacentHTML( 'beforeend', '<dialog id="other"></dialog>' );
		$( 'other' ).dispatchEvent( new CustomEvent( 'bl:dialog-open', { bubbles: true } ) );
		expect( $( 'l' ).parentElement ).toBe( $( 'n' ) );
	} );

	it( 'does nothing, and is not ready, without its dialog', () => {
		$( 'l' ).setAttribute( 'data-bl-portal', 'missing' );
		expect( follow( $( 'l' ) ) ).toBeUndefined();
		expect( $( 'l' ).hasAttribute( 'data-bl-portal-ready' ) ).toBe( false );
	} );

	it( 'cleans up: listeners off, back home', () => {
		const stop = follow( $( 'l' ) );
		event( 'bl:dialog-open' );
		stop?.();
		expect( $( 'l' ).parentElement ).toBe( $( 'n' ) );
		event( 'bl:dialog-open' );
		expect( $( 'l' ).parentElement ).toBe( $( 'n' ) );
	} );
} );
