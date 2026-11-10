/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as core from './disclosure-core';

const MENU = `
<ul>
	<li id="a" data-wp-interactive="blicks/disclosure">
		<button id="ta" aria-expanded="false" aria-controls="pa">A</button>
		<div id="pa"><a id="la" href="#">Inside A</a></div>
	</li>
	<li id="b" data-wp-interactive="blicks/disclosure">
		<button id="tb" aria-expanded="false" aria-controls="pb">B</button>
		<div id="pb"></div>
	</li>
</ul>
<button id="away">Away</button>`;

const $ = ( id: string ) => document.getElementById( id ) as HTMLElement;
let events: string[] = [];
let listening = new AbortController();

beforeEach( () => {
	document.body.innerHTML = MENU;
	events = [];
	listening.abort();
	listening = new AbortController();
	const { signal } = listening;
	document.addEventListener( 'bl:disclosure-open', ( e ) => events.push( `open:${ ( e.target as Element ).id }:${ ( e as CustomEvent ).detail.source }` ), { signal } );
	document.addEventListener( 'bl:disclosure-close', ( e ) => events.push( `close:${ ( e.target as Element ).id }:${ ( e as CustomEvent ).detail.reason }` ), { signal } );
} );

describe( 'disclosure', () => {
	it( 'finds the region, its toggle and its panel', () => {
		expect( core.regionOf( $( 'la' ) ) ).toBe( $( 'a' ) );
		expect( core.toggleOf( $( 'a' ) ) ).toBe( $( 'ta' ) );
		expect( core.panelOf( $( 'a' ) ) ).toBe( $( 'pa' ) );
	} );

	it( 'ignores a toggle that belongs to a nested region', () => {
		$( 'pa' ).innerHTML = '<div id="n" data-wp-interactive="blicks/disclosure"><button id="tn" aria-expanded="false" aria-controls="x"></button></div>';
		$( 'ta' ).remove();
		expect( core.toggleOf( $( 'a' ) ) ).toBeNull();
		expect( core.toggleOf( $( 'n' ) ) ).toBe( $( 'tn' ) );
	} );

	it( 'opens and closes from its toggle, through aria-expanded', () => {
		core.toggled( $( 'a' ) );
		expect( $( 'ta' ).getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		core.toggled( $( 'a' ) );
		expect( $( 'ta' ).getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		expect( events ).toEqual( [ 'open:a:click', 'close:a:button' ] );
	} );

	it( 'closes its open siblings when it opens', () => {
		core.open( $( 'a' ), 'click' );
		core.open( $( 'b' ), 'click' );
		expect( core.isOpen( $( 'a' ) ) ).toBe( false );
		expect( core.isOpen( $( 'b' ) ) ).toBe( true );
		expect( events ).toContain( 'close:a:sibling' );
	} );

	it( 'closes on Esc, returns focus to the toggle and keeps the key from a dialog', () => {
		core.open( $( 'a' ), 'click' );
		$( 'la' ).focus();
		const e = new KeyboardEvent( 'keydown', { key: 'Escape', cancelable: true } );
		core.keyed( $( 'a' ), e );
		expect( core.isOpen( $( 'a' ) ) ).toBe( false );
		expect( document.activeElement ).toBe( $( 'ta' ) );
		expect( e.defaultPrevented ).toBe( true );
	} );

	it( 'leaves Esc alone while closed', () => {
		const e = new KeyboardEvent( 'keydown', { key: 'Escape', cancelable: true } );
		core.keyed( $( 'a' ), e );
		expect( e.defaultPrevented ).toBe( false );
	} );

	it( 'closes when focus moves elsewhere on the page, not within or to nowhere', () => {
		core.open( $( 'a' ), 'click' );
		core.focusedOut( $( 'a' ), new FocusEvent( 'focusout', { relatedTarget: $( 'la' ) } ) );
		core.focusedOut( $( 'a' ), new FocusEvent( 'focusout', { relatedTarget: null } ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( true );
		core.focusedOut( $( 'a' ), new FocusEvent( 'focusout', { relatedTarget: $( 'away' ) } ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( false );
	} );

	it( 'closes on a click outside, not inside', () => {
		core.open( $( 'a' ), 'click' );
		$( 'la' ).addEventListener( 'click', ( e ) => core.clickedOutside( $( 'a' ), e ) );
		$( 'la' ).click();
		expect( core.isOpen( $( 'a' ) ) ).toBe( true );
		$( 'away' ).addEventListener( 'click', ( e ) => core.clickedOutside( $( 'a' ), e ) );
		$( 'away' ).click();
		expect( core.isOpen( $( 'a' ) ) ).toBe( false );
	} );

	it( 'opens on hover intent, closes only what hover opened, and pins on a click', () => {
		const intent = ( on: boolean ) => new CustomEvent( 'bl-intent', { detail: { on } } );
		core.intended( $( 'a' ), intent( true ) );
		expect( $( 'a' ).getAttribute( 'data-bl-open' ) ).toBe( 'hover' );
		core.toggled( $( 'a' ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( true );
		core.intended( $( 'a' ), intent( false ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( true );
	} );

	it( 'is an accordion inside an open dialog: focus, outside clicks and hover leave it be', () => {
		document.body.innerHTML = `<dialog open>${ MENU }</dialog>`;
		core.open( $( 'a' ), 'click' );
		core.focusedOut( $( 'a' ), new FocusEvent( 'focusout', { relatedTarget: $( 'away' ) } ) );
		core.intended( $( 'a' ), new CustomEvent( 'bl-intent', { detail: { on: false } } ) );
		$( 'away' ).addEventListener( 'click', ( e ) => core.clickedOutside( $( 'a' ), e ) );
		$( 'away' ).click();
		expect( core.isOpen( $( 'a' ) ) ).toBe( true );
	} );

	it( 'closes on scroll only when asked to', () => {
		core.open( $( 'a' ), 'click' );
		core.scrolled( $( 'a' ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( true );
		$( 'a' ).setAttribute( 'data-bl-close-on-scroll', '' );
		core.scrolled( $( 'a' ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( false );
	} );

	it( 'closes a panel the pointer opened on Esc with focus elsewhere, and leaves focus be', () => {
		core.intended( $( 'a' ), new CustomEvent( 'bl-intent', { detail: { on: true } } ) );
		$( 'away' ).focus();
		core.escaped( $( 'a' ), new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( core.isOpen( $( 'a' ) ) ).toBe( false );
		expect( document.activeElement ).toBe( $( 'away' ) );
	} );

	it( 'moves focus into a next screen opened by a click in a dialog', () => {
		document.body.innerHTML = `<dialog open>${ MENU }</dialog>`;
		$( 'pa' ).insertAdjacentHTML( 'afterbegin', '<button id="back" data-bl-focus>Back</button>' );
		core.toggled( $( 'a' ) );
		expect( document.activeElement ).toBe( $( 'back' ) );
	} );
} );
