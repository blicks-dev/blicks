// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { memoryKey } from './auto-core';

vi.mock( '@wordpress/interactivity', () => ( { store: () => ( { actions: { open: () => undefined } } ) } ) );

describe( 'counts', () => {
	it( 'counts a saved dialog shown, and a conversion once per opening; never an unsaved one', async () => {
		const { track, eventsUrl } = await import( './auto' );
		document.body.innerHTML = `
			<script type="application/json" id="wp-script-module-data-@blicks-pro/dialog-auto">{"events":"https://example.test/wp-json/blicks-pro/v1/dialogs/"}</script>
			<dialog id="dialog-a" data-bl-saved="12"><form><button>Go</button></form><a href="/shop">Shop</a><a href="#dialog-b">B</a></dialog>
			<dialog id="dialog-inline"><a href="/shop">Shop</a></dialog>`;
		expect( eventsUrl( document ) ).toBe( 'https://example.test/wp-json/blicks-pro/v1/dialogs/' );

		const sent: string[] = [];
		track( document, ( id, event ) => sent.push( `${ id }:${ event }` ) );
		const a = document.getElementById( 'dialog-a' )!;
		const open = ( el: Element ) => el.dispatchEvent( new CustomEvent( 'bl:dialog-open', { bubbles: true } ) );
		const click = ( el: Element ) => el.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		open( a );
		click( a.querySelector( 'a[href="#dialog-b"]' )! );
		click( a.querySelector( 'a[href="/shop"]' )! );
		a.querySelector( 'form' )!.dispatchEvent( new Event( 'submit', { bubbles: true, cancelable: true } ) );
		open( a );
		open( document.getElementById( 'dialog-inline' )! );
		click( document.querySelector( '#dialog-inline a' )! );

		expect( sent ).toEqual( [ '12:shown', '12:converted', '12:shown' ] );
		expect( JSON.parse( localStorage.getItem( memoryKey( 12 ) ) ?? '{}' ).converted ).toBeGreaterThan( 0 );
	} );
} );
