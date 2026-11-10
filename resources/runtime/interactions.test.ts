/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll( () => {
	( globalThis as { __blicksTest?: boolean } ).__blicksTest = true;
	window.matchMedia = ( ( q: string ) => ( { matches: false, media: q } ) ) as never;
} );

const make = ( html: string ): HTMLElement => {
	document.body.innerHTML = html;
	return document.body.firstElementChild as HTMLElement;
};

describe( 'interactions', async () => {
	const { start } = await import( './interactions' );

	it( 'replays the play state on every press, with the press point', () => {
		const el = make( '<a href="#x" data-bl-do="replay">Go</a>' );
		start();
		el.getBoundingClientRect = () => ( { left: 10, top: 20, width: 100, height: 40 } ) as DOMRect;
		el.dispatchEvent( new PointerEvent( 'pointerdown', { clientX: 40, clientY: 30, bubbles: true } ) );
		expect( el.hasAttribute( 'data-bl-play' ) ).toBe( true );
		expect( el.style.getPropertyValue( '--bl-cx' ) ).toBe( '30px' );
		expect( el.style.getPropertyValue( '--bl-cy' ) ).toBe( '10px' );
		el.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true } ) );
		expect( el.style.getPropertyValue( '--bl-cx' ) ).toBe( '50px' );
	} );

	it( 'toggles the block on and says so to assistive tech, without following an in-page link', () => {
		const el = make( '<a href="#" data-bl-do="toggle">Play</a>' );
		start();
		const click = new MouseEvent( 'click', { bubbles: true, cancelable: true } );
		el.dispatchEvent( click );
		expect( click.defaultPrevented ).toBe( true );
		expect( el.hasAttribute( 'data-bl-active' ) ).toBe( true );
		expect( el.getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		el.click();
		expect( el.hasAttribute( 'data-bl-active' ) ).toBe( false );
	} );

	it( 'toggles its card, and Escape or a click outside turns it off', () => {
		make( '<div class="bl-group--card"><button data-bl-do="toggle" data-bl-toggle="card">More</button><div>menu</div></div><p id="out">x</p>' );
		start();
		const card = document.querySelector( '.bl-group--card' )!;
		const button = card.querySelector( 'button' )!;
		button.click();
		expect( card.hasAttribute( 'data-bl-active' ) ).toBe( true );
		expect( button.getAttribute( 'aria-expanded' ) ).toBe( 'true' );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( card.hasAttribute( 'data-bl-active' ) ).toBe( false );
		button.click();
		document.getElementById( 'out' )!.click();
		expect( card.hasAttribute( 'data-bl-active' ) ).toBe( false );
	} );

	it( 'leans toward a pointer within reach, from where it rests, and lets go beyond it', () => {
		const el = make( '<div data-bl-do="follow" data-bl-follow="10">x</div>' );
		const box = ( left: number ) => {
			for ( const [ k, v ] of Object.entries( { offsetLeft: left, offsetTop: 0, offsetWidth: 100, offsetHeight: 100, offsetParent: null } ) ) {
				Object.defineProperty( el, k, { configurable: true, get: () => v } );
			}
		};
		box( 0 );
		start();
		const move = ( x: number ) => document.dispatchEvent( new PointerEvent( 'pointermove', { clientX: x, clientY: 50, pointerType: 'mouse' } ) );
		move( 130 );
		expect( el.style.getPropertyValue( '--bl-px' ) ).toBe( '10.00px' );
		expect( el.style.getPropertyValue( '--bl-py' ) ).toBe( '0.00px' );
		// Leaning moves the box on screen, not in layout: the same pointer gives the same lean.
		move( 130 );
		expect( el.style.getPropertyValue( '--bl-px' ) ).toBe( '10.00px' );
		move( 500 );
		expect( el.style.getPropertyValue( '--bl-px' ) ).toBe( '' );
		expect( el.style.getPropertyValue( '--bl-mx' ) ).toBe( '' );
		document.dispatchEvent( new PointerEvent( 'pointermove', { clientX: 60, clientY: 50, pointerType: 'touch' } ) );
		expect( el.style.getPropertyValue( '--bl-px' ) ).toBe( '' );
	} );

	it( 'keeps every control of one card in step, with one Escape that returns to the opener', () => {
		make( '<div class="bl-group--card"><button id="a" data-bl-do="toggle" data-bl-toggle="card">Recipe</button><button id="b" data-bl-do="toggle" data-bl-toggle="card">Photo</button></div>' );
		start();
		const [ a, b ] = [ document.getElementById( 'a' )!, document.getElementById( 'b' )! ];
		a.click();
		expect( [ a.getAttribute( 'aria-expanded' ), b.getAttribute( 'aria-expanded' ) ] ).toEqual( [ 'true', 'true' ] );
		b.click();
		expect( [ a.getAttribute( 'aria-expanded' ), b.getAttribute( 'aria-expanded' ) ] ).toEqual( [ 'false', 'false' ] );
		b.click();
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( document.activeElement ).toBe( b );
		expect( a.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
	} );

	it( 'a kept card stays on through Escape and outside clicks, and a set pair acts like options', () => {
		make( '<div class="bl-group--card"><button id="m" data-bl-do="toggle" data-bl-toggle="card" data-bl-set="off">Monthly</button><button id="y" data-bl-do="toggle" data-bl-toggle="card" data-bl-set="on">Yearly</button></div><p id="out">x</p>' );
		start();
		const card = document.querySelector( '.bl-group--card' )!;
		const [ m, y ] = [ document.getElementById( 'm' )!, document.getElementById( 'y' )! ];
		expect( [ m.getAttribute( 'aria-pressed' ), y.getAttribute( 'aria-pressed' ) ] ).toEqual( [ 'true', 'false' ] );
		y.click();
		y.click();
		expect( card.hasAttribute( 'data-bl-active' ) ).toBe( true );
		expect( [ m.getAttribute( 'aria-pressed' ), y.getAttribute( 'aria-pressed' ) ] ).toEqual( [ 'false', 'true' ] );
		document.getElementById( 'out' )!.click();
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( card.hasAttribute( 'data-bl-active' ) ).toBe( true );
		m.click();
		expect( card.hasAttribute( 'data-bl-active' ) ).toBe( false );
	} );

	it( 'wires a block once', () => {
		const el = make( '<button data-bl-do="toggle">x</button>' );
		start();
		start();
		el.click();
		expect( el.hasAttribute( 'data-bl-active' ) ).toBe( true );
	} );

	it( 'makes a pressable box reachable by Tab and named a button, without stealing Space from the page', () => {
		const el = make( '<div data-bl-do="replay">Press</div>' );
		start();
		expect( el.tabIndex ).toBe( 0 );
		expect( el.getAttribute( 'role' ) ).toBe( 'button' );
		el.getBoundingClientRect = () => ( { left: 0, top: 0, width: 10, height: 10 } ) as DOMRect;
		const space = new KeyboardEvent( 'keydown', { key: ' ', bubbles: true, cancelable: true } );
		el.dispatchEvent( space );
		expect( space.defaultPrevented ).toBe( true );
		expect( el.hasAttribute( 'data-bl-play' ) ).toBe( true );
	} );

	it( 'reports a toggling box’s state, and leaves links, buttons and boxes holding controls alone', () => {
		const box = make( '<div data-bl-do="toggle">Switch</div>' );
		start();
		box.click();
		expect( box.getAttribute( 'aria-pressed' ) ).toBe( 'true' );

		const link = make( '<a href="#x" data-bl-do="replay">Go</a>' );
		start();
		expect( link.hasAttribute( 'role' ) ).toBe( false );
		expect( link.hasAttribute( 'tabindex' ) ).toBe( false );

		const holder = make( '<div data-bl-do="replay"><a href="/x">Inside</a></div>' );
		start();
		expect( holder.hasAttribute( 'tabindex' ) ).toBe( false );
		expect( holder.hasAttribute( 'role' ) ).toBe( false );

		const follower = make( '<div data-bl-do="follow">Lean</div>' );
		start();
		expect( follower.hasAttribute( 'tabindex' ) ).toBe( false );
	} );
} );
