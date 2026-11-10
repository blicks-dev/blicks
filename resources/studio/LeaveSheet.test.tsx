// @vitest-environment jsdom
/**
 * The leave prompt owns Escape while it is up — the Studio's escape ladder stands down for it — so
 * it has to close itself. Escape and a click on the scrim both mean "keep working"; neither may
 * ever discard, because discarding is the one action here that loses work.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LeaveSheet } from './LeaveSheet';

( globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let handlers: Record< 'onInsert' | 'onSave' | 'onCopy' | 'onDiscard' | 'onCancel', ReturnType< typeof vi.fn< () => void > > >;

function render(): void {
	act( () => {
		root.render( <LeaveSheet label="Hero" steps={ 3 } { ...handlers } /> );
	} );
}

const press = ( key: string, init: KeyboardEventInit = {} ): void => {
	act( () => {
		document.activeElement?.dispatchEvent( new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true, ...init } ) );
	} );
};

const button = ( text: string ): HTMLButtonElement =>
	[ ...host.querySelectorAll( 'button' ) ].find( ( b ) => b.textContent?.includes( text ) ) as HTMLButtonElement;

beforeEach( () => {
	host = document.createElement( 'div' );
	document.body.append( host );
	root = createRoot( host );
	handlers = { onInsert: vi.fn(), onSave: vi.fn(), onCopy: vi.fn(), onDiscard: vi.fn(), onCancel: vi.fn() };
} );

afterEach( () => {
	act( () => root.unmount() );
	host.remove();
} );

describe( 'LeaveSheet', () => {
	it( 'is a modal dialog named by its title', () => {
		render();
		const dialog = host.querySelector( '[role="alertdialog"]' ) as HTMLElement;

		expect( dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );
		expect( document.getElementById( dialog.getAttribute( 'aria-labelledby' ) as string )?.textContent ).toBe( 'Leave the Studio' );
	} );

	it( 'starts focus on "Keep working", not on the door that discards', () => {
		render();
		expect( document.activeElement ).toBe( button( 'Keep working' ) );
	} );

	it( 'closes on Escape, keeping the work', () => {
		render();
		press( 'Escape' );

		expect( handlers.onCancel ).toHaveBeenCalledTimes( 1 );
		expect( handlers.onDiscard ).not.toHaveBeenCalled();
	} );

	it( 'closes on a click on the scrim, but not on one inside the sheet', () => {
		render();
		const scrim = host.querySelector( '.bl-studio-scrim' ) as HTMLElement;
		const sheet = host.querySelector( '.bl-studio-sheet' ) as HTMLElement;

		act( () => {
			sheet.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );
		} );
		expect( handlers.onCancel ).not.toHaveBeenCalled();

		act( () => {
			scrim.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );
		} );
		expect( handlers.onCancel ).toHaveBeenCalledTimes( 1 );
		expect( handlers.onDiscard ).not.toHaveBeenCalled();
	} );

	it( 'keeps Tab inside the sheet', () => {
		render();
		const buttons = [ ...host.querySelectorAll( 'button' ) ];

		act( () => buttons[ buttons.length - 1 ].focus() );
		press( 'Tab' );
		expect( document.activeElement ).toBe( buttons[ 0 ] );

		press( 'Tab', { shiftKey: true } );
		expect( document.activeElement ).toBe( buttons[ buttons.length - 1 ] );
	} );

	it( 'gives focus back to what had it when it closes', () => {
		const opener = document.createElement( 'button' );
		document.body.append( opener );
		opener.focus();

		render();
		act( () => root.render( <></> ) );

		expect( document.activeElement ).toBe( opener );
		opener.remove();
	} );

	it( 'discards only through the button that says so', () => {
		render();
		act( () => button( 'Discard and close' ).click() );

		expect( handlers.onDiscard ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'names the door after a mode that saves elsewhere, and still calls it', () => {
		act( () => {
			root.render( <LeaveSheet label="Main header" steps={ 2 } door="Save header" { ...handlers } /> );
		} );

		expect( button( 'Insert into the post' ) ).toBeUndefined();
		act( () => button( 'Save header' ).click() );
		expect( handlers.onInsert ).toHaveBeenCalledTimes( 1 );
	} );
} );
