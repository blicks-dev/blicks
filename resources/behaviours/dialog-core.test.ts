/**
 * @vitest-environment jsdom
 *
 * jsdom has `<dialog>` but none of its methods, so they are stood in for here with what the
 * platform does: `open` set and cleared, a `close` event on close. The browser's own parts
 * (top layer, inert page, Esc) are the e2e suite's.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from './dialog-core';

beforeAll( () => {
	const proto = HTMLDialogElement.prototype as any;
	proto.show = function () { this.setAttribute( 'open', '' ); this.dataset.how = 'show'; };
	proto.showModal = function () { this.setAttribute( 'open', '' ); this.dataset.how = 'modal'; };
	proto.close = function () {
		if ( ! this.hasAttribute( 'open' ) ) return;
		this.removeAttribute( 'open' );
		this.dispatchEvent( new Event( 'close' ) );
	};
	const element = HTMLElement.prototype as any;
	element.showPopover = function () { this.dataset.popover = 'shown'; };
	element.hidePopover = function () { this.dataset.popover = 'hidden'; };
	Object.defineProperty( proto, 'open', { configurable: true, get() { return this.hasAttribute( 'open' ); } } );
} );

let events: Array< { type: string; detail: any } > = [];

beforeEach( () => {
	events = [];
	history.replaceState( null, '', '/' );
	vi.spyOn( core.supports, 'commands' ).mockReturnValue( false );
	vi.spyOn( core.supports, 'closedBy' ).mockReturnValue( false );
} );

function page( html: string ): HTMLDialogElement {
	document.body.innerHTML = html;
	const dialog = document.querySelector( 'dialog' ) as HTMLDialogElement;
	dialog.addEventListener( 'close', () => core.closed( dialog ) );
	for ( const type of [ 'bl:dialog-open', 'bl:dialog-close' ] ) document.addEventListener( type, ( e ) => events.push( { type, detail: ( e as CustomEvent ).detail } ) );
	return dialog;
}

const click = ( el: Element, init: MouseEventInit = {} ) => {
	const e = new MouseEvent( 'click', { bubbles: true, cancelable: true, button: 0, ...init } );
	el.dispatchEvent( e );
	return e;
};

const DIALOG = '<dialog class="bl-dialog is-modal" id="dialog-guide" closedby="any"><button type="button" class="bl-dialog__close" commandfor="dialog-guide" command="close">x</button><p>Sizes</p></dialog>';

describe( 'dialog behaviour', () => {
	it( 'opens from a Button where the browser has no invoker commands, and gives focus back', () => {
		const dialog = page( `<button id="b" commandfor="dialog-guide" command="show-modal">Open</button>${ DIALOG }` );
		const button = document.getElementById( 'b' ) as HTMLButtonElement;
		button.focus();
		const e = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
		button.dispatchEvent( e );
		core.clicked( dialog, e );

		expect( dialog.dataset.how ).toBe( 'modal' );
		expect( e.defaultPrevented ).toBe( true );

		const close = dialog.querySelector( 'button' ) as HTMLButtonElement;
		close.focus();
		core.clicked( dialog, Object.defineProperty( new MouseEvent( 'click', { cancelable: true } ), 'target', { value: close } ) );

		expect( dialog.open ).toBe( false );
		expect( document.activeElement ).toBe( button );
		expect( events.map( ( x ) => [ x.type, x.detail.source, x.detail.reason ] ) ).toEqual( [
			[ 'bl:dialog-open', 'click', undefined ],
			[ 'bl:dialog-close', 'click', 'button' ],
		] );
	} );

	it( 'leaves Buttons for another dialog alone', () => {
		const dialog = page( `<button id="b" commandfor="dialog-other" command="show-modal">Open</button>${ DIALOG }` );
		const e = click( document.getElementById( 'b' )! );
		core.clicked( dialog, Object.defineProperty( e, 'target', { value: document.getElementById( 'b' ) } ) );

		expect( dialog.open ).toBe( false );
	} );

	it( 'opens from a link to its address, but not on a modified click', () => {
		const dialog = page( `<a id="a" href="#dialog-guide">Sizes</a>${ DIALOG }` );
		const link = document.getElementById( 'a' )!;

		const ctrl = new MouseEvent( 'click', { cancelable: true, ctrlKey: true } );
		core.clicked( dialog, Object.defineProperty( ctrl, 'target', { value: link } ) );
		expect( dialog.open ).toBe( false );

		const plain = new MouseEvent( 'click', { cancelable: true } );
		core.clicked( dialog, Object.defineProperty( plain, 'target', { value: link } ) );
		expect( dialog.open ).toBe( true );
		expect( plain.defaultPrevented ).toBe( true );
	} );

	it( 'opens from its address on load, and drops the address on close', () => {
		const dialog = page( DIALOG );
		history.replaceState( null, '', '/shop/#dialog-guide' );
		core.addressed( dialog );
		expect( dialog.open ).toBe( true );

		core.close( dialog, 'api' );
		expect( location.hash ).toBe( '' );
		expect( location.pathname ).toBe( '/shop/' );
		expect( events.at( -1 )?.detail ).toEqual( { id: 'dialog-guide', source: 'hash', reason: 'api' } );
	} );

	it( 'opens a dialog saved without Blocks the page with show(), even from show-modal', () => {
		const dialog = page( DIALOG.replace( ' is-modal', '' ) );
		const e = Object.assign( new Event( 'command', { cancelable: true } ), { command: 'show-modal', source: null } );
		core.command( dialog, e );

		expect( e.defaultPrevented ).toBe( true );
		expect( dialog.dataset.how ).toBe( 'show' );
	} );

	it( 'closes a non-modal dialog on Esc where the browser lacks closedby', () => {
		const dialog = page( DIALOG.replace( ' is-modal', '' ) );
		core.open( dialog );
		core.keyed( dialog, new KeyboardEvent( 'keydown', { key: 'Escape' } ) );

		expect( dialog.open ).toBe( false );
		expect( events.at( -1 )?.detail.reason ).toBe( 'esc' );
	} );

	it( 'closes on a click outside its box only when closedby is any', () => {
		const dialog = page( DIALOG );
		dialog.getBoundingClientRect = () => ( { left: 100, right: 300, top: 100, bottom: 300 } ) as DOMRect;
		core.open( dialog );

		const inside = new MouseEvent( 'click', { clientX: 150, clientY: 150 } );
		core.clicked( dialog, Object.defineProperty( inside, 'target', { value: dialog } ) );
		expect( dialog.open ).toBe( true );

		const out = new MouseEvent( 'click', { clientX: 10, clientY: 10 } );
		core.clicked( dialog, Object.defineProperty( out, 'target', { value: dialog } ) );
		expect( dialog.open ).toBe( false );
		expect( events.at( -1 )?.detail.reason ).toBe( 'outside' );

		dialog.setAttribute( 'closedby', 'closerequest' );
		core.open( dialog );
		core.clicked( dialog, Object.defineProperty( new MouseEvent( 'click', { clientX: 10, clientY: 10 } ), 'target', { value: dialog } ) );
		expect( dialog.open ).toBe( true );
	} );

	it( 'opens a Loop card’s item from any link in the card to the item’s url, and puts its rule classes on the blocks', () => {
		const dialog = page( `<ul><li data-bl-dialog="dialog-guide" data-bl-url="/item/a/"><a id="author" href="/author/">By</a><a id="picture" href="/item/a/">Pic</a><a id="title" href="/item/a/">A</a><template class="bl-loop__dialog" data-rules="is-badge-brand"><h2>Item A</h2></template></li></ul>${ DIALOG }` );
		const at = ( id: string ) => {
			const e = new MouseEvent( 'click', { cancelable: true } );
			core.clicked( dialog, Object.defineProperty( e, 'target', { value: document.getElementById( id ) } ) );
			return e;
		};

		expect( at( 'author' ).defaultPrevented ).toBe( false );
		expect( dialog.open ).toBe( false );

		expect( at( 'title' ).defaultPrevented ).toBe( true );
		expect( dialog.open ).toBe( true );
		expect( dialog.querySelector( '.bl-dialog__item' )?.className ).toBe( 'bl-dialog__item is-badge-brand' );
		dialog.close();

		expect( at( 'picture' ).defaultPrevented ).toBe( true );
		expect( dialog.open ).toBe( true );
	} );

	it( 'opens a Loop card’s item without a url field from links to where its first link goes', () => {
		const dialog = page( `<ul><li data-bl-dialog="dialog-guide"><a id="first" href="/item/a/">A</a><a id="second" href="/author/">By</a><template class="bl-loop__dialog"><h2>Item A</h2></template></li></ul>${ DIALOG }` );

		const second = new MouseEvent( 'click', { cancelable: true } );
		core.clicked( dialog, Object.defineProperty( second, 'target', { value: document.getElementById( 'second' ) } ) );
		expect( dialog.open ).toBe( false );

		const first = new MouseEvent( 'click', { cancelable: true } );
		core.clicked( dialog, Object.defineProperty( first, 'target', { value: document.getElementById( 'first' ) } ) );
		expect( dialog.open ).toBe( true );
		expect( first.defaultPrevented ).toBe( true );
		expect( dialog.querySelector( '.bl-dialog__item h2' )?.textContent ).toBe( 'Item A' );
		expect( dialog.getAttribute( 'aria-labelledby' ) ).toBe( 'dialog-guide-title' );
		expect( events.at( -1 )?.detail.source ).toBe( 'loop' );
	} );

	const ITEMS = `<ul><li data-bl-dialog="dialog-guide" data-bl-item="lamp"><a id="lamp" href="/item/lamp/">Lamp</a><template class="bl-loop__dialog"><h2>Lamp</h2></template></li><li data-bl-dialog="dialog-guide" data-bl-item="rug"><a id="rug" href="/item/rug/">Rug</a><template class="bl-loop__dialog"><h2>Rug</h2></template></li></ul>${ DIALOG }`;

	it( 'puts the opened item in the address, and Back closes it', () => {
		const dialog = page( ITEMS );
		history.replaceState( null, '', '/shop/?sort=new' );

		const e = new MouseEvent( 'click', { cancelable: true } );
		core.clicked( dialog, Object.defineProperty( e, 'target', { value: document.getElementById( 'rug' ) } ) );
		expect( location.search ).toBe( '?sort=new&item=rug' );
		expect( history.state ).toEqual( { blDialog: 'dialog-guide' } );

		// Back: the browser restores the entry before, then fires popstate.
		history.replaceState( null, '', '/shop/?sort=new' );
		core.moved( dialog );
		expect( dialog.open ).toBe( false );
		expect( events.at( -1 ) ).toMatchObject( { type: 'bl:dialog-close', detail: { reason: 'back' } } );
	} );

	it( 'closing an item dialog undoes the entry it pushed', () => {
		const dialog = page( ITEMS );
		const back = vi.spyOn( history, 'back' ).mockImplementation( () => {} );

		const e = new MouseEvent( 'click', { cancelable: true } );
		core.clicked( dialog, Object.defineProperty( e, 'target', { value: document.getElementById( 'lamp' ) } ) );
		core.close( dialog, 'button' );

		expect( back ).toHaveBeenCalledOnce();
		back.mockRestore();
	} );

	it( 'opens the item a page was loaded with, and drops it from the address on close', () => {
		history.replaceState( null, '', '/shop/?item=rug' );
		const dialog = page( ITEMS );
		core.addressed( dialog );

		expect( dialog.open ).toBe( true );
		expect( dialog.querySelector( '.bl-dialog__item h2' )?.textContent ).toBe( 'Rug' );

		core.close( dialog, 'button' );
		expect( location.search ).toBe( '' );
		expect( document.activeElement?.id ).toBe( 'rug' );
	} );

	it( 'leaves the address alone for a Loop that does not put items in it', () => {
		const dialog = page( `<ul><li data-bl-dialog="dialog-guide"><a id="a" href="/item/a/">A</a><template class="bl-loop__dialog"><h2>A</h2></template></li></ul>${ DIALOG }` );
		const e = new MouseEvent( 'click', { cancelable: true } );
		core.clicked( dialog, Object.defineProperty( e, 'target', { value: document.getElementById( 'a' ) } ) );

		expect( dialog.open ).toBe( true );
		expect( location.search ).toBe( '' );
	} );

	it( 'shrugs off an address that is not valid percent-encoding', () => {
		history.replaceState( null, '', '/#%E0%A4%A' );
		const dialog = page( DIALOG );
		expect( () => core.addressed( dialog ) ).not.toThrow();
		expect( dialog.open ).toBe( false );
	} );

	it( 'says a click outside closed it, though the browser also fires cancel for it', () => {
		vi.mocked( core.supports.closedBy ).mockReturnValue( true );
		const dialog = page( DIALOG );
		Object.assign( dialog, { getBoundingClientRect: () => ( { left: 100, right: 300, top: 100, bottom: 300 } ) } );
		core.open( dialog );

		core.pressed( dialog, Object.defineProperty( new MouseEvent( 'pointerdown', { clientX: 10, clientY: 10 } ), 'target', { value: dialog } ) as PointerEvent );
		core.cancelled( dialog );
		dialog.close();
		expect( events.at( -1 )?.detail.reason ).toBe( 'outside' );

		core.open( dialog );
		core.cancelled( dialog );
		dialog.close();
		expect( events.at( -1 )?.detail.reason ).toBe( 'esc' );
	} );

	it( 'shows a dialog that does not block the page as a popover, and hides it on close', () => {
		const dialog = page( '<dialog class="bl-dialog" id="dialog-notice" popover="manual"><button>Fine</button></dialog>' );
		core.open( dialog );
		expect( dialog.dataset.how ).toBe( 'show' );
		expect( dialog.dataset.popover ).toBe( 'shown' );

		core.close( dialog, 'button' );
		expect( dialog.dataset.popover ).toBe( 'hidden' );
	} );
} );
