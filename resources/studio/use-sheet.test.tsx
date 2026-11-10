// @vitest-environment jsdom
/**
 * Every Studio sheet closes itself on Escape and on a press outside it, keeps focus inside, and
 * gives focus back — and the key it settles never reaches the escape ladder underneath, which
 * would otherwise go on to ask about leaving the Studio.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KeysSheet } from './KeysSheet';
import { SavePatternSheet } from './SavePatternSheet';

vi.mock( '@wordpress/api-fetch', () => ( { default: vi.fn( () => Promise.resolve( [] ) ) } ) );

( globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const mount = ( node: JSX.Element ): void => act( () => root.render( node ) );

const press = ( key: string, init: KeyboardEventInit = {} ): void => {
	act( () => {
		( document.activeElement ?? document.body ).dispatchEvent(
			new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true, ...init } )
		);
	} );
};

beforeEach( () => {
	host = document.createElement( 'div' );
	document.body.append( host );
	root = createRoot( host );
} );

afterEach( () => {
	act( () => root.unmount() );
	host.remove();
} );

describe( 'Studio sheets', () => {
	it( 'settle Escape before the escape ladder underneath sees it', () => {
		const onClose = vi.fn();
		const ladder = vi.fn();
		window.addEventListener( 'keydown', ladder );

		mount( <KeysSheet onClose={ onClose } /> );
		press( 'Escape' );

		window.removeEventListener( 'keydown', ladder );
		expect( onClose ).toHaveBeenCalledTimes( 1 );
		expect( ladder ).not.toHaveBeenCalled();
	} );

	it( 'close on a press on the scrim, not on one inside the sheet', () => {
		const onClose = vi.fn();
		mount( <KeysSheet onClose={ onClose } /> );

		act( () => {
			host.querySelector( '.bl-studio-sheet' )?.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );
		} );
		expect( onClose ).not.toHaveBeenCalled();

		act( () => {
			host.querySelector( '.bl-studio-scrim' )?.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );
		} );
		expect( onClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'are modal dialogs named by their titles', () => {
		mount( <KeysSheet onClose={ () => undefined } /> );
		const dialog = host.querySelector( '[role="dialog"]' ) as HTMLElement;

		expect( dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );
		expect( document.getElementById( dialog.getAttribute( 'aria-labelledby' ) as string )?.textContent ).toBe( 'Keyboard shortcuts' );
	} );

	it( 'start focus where the sheet is for: Close on the map, the name on Save', () => {
		mount( <KeysSheet onClose={ () => undefined } /> );
		expect( document.activeElement?.textContent ).toBe( 'Close' );

		mount( <></> );
		mount( <SavePatternSheet blocks={ [] } suggestion="Hero" onClose={ () => undefined } /> );
		expect( ( document.activeElement as HTMLInputElement ).value ).toBe( 'Hero' );
	} );

	it( 'keep Tab inside the sheet', () => {
		mount( <SavePatternSheet blocks={ [] } suggestion="Hero" onClose={ () => undefined } /> );
		const items = [ ...host.querySelectorAll< HTMLElement >( 'input, select, button' ) ];

		act( () => items[ items.length - 1 ].focus() );
		press( 'Tab' );
		expect( document.activeElement ).toBe( items[ 0 ] );

		press( 'Tab', { shiftKey: true } );
		expect( document.activeElement ).toBe( items[ items.length - 1 ] );
	} );

	it( 'give focus back to what had it', () => {
		const opener = document.createElement( 'button' );
		document.body.append( opener );
		opener.focus();

		mount( <KeysSheet onClose={ () => undefined } /> );
		mount( <></> );

		expect( document.activeElement ).toBe( opener );
		opener.remove();
	} );
} );
