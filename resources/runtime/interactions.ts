/**
 * Block interactions: the few behaviours CSS cannot give a block, run by one small script that is
 * only enqueued on pages that use one.
 *
 * A block opts in with `data-bl-do="follow replay toggle"` (written by the Studio's Motion tab as a
 * custom attribute). The script never styles anything: it sets a variable or flips a state, and
 * the block's own styles for that state — set in the Style tab like any hover look — do the rest.
 *
 * - `follow`  — while the pointer is near, `--bl-px`/`--bl-py` (px, signed, up to
 *               `data-bl-follow`) and `--bl-mx`/`--bl-my` (pointer position over the block, %).
 * - `replay`  — on press or Enter/Space, restarts the `play` state (`[data-bl-play]`), with
 *               `--bl-cx`/`--bl-cy` at the press point, so a ripple or a jelly plays every time.
 * - `toggle`  — on click, flips the `on` state (`[data-bl-active]`) on the block, or on its card
 *               with `data-bl-toggle="card"` (Escape and a click outside turn a card off, unless a
 *               control has `data-bl-keep`). `data-bl-set="on|off"` sets instead of flipping, for
 *               a pair of options such as Monthly / Yearly. Every control of a card stays in step.
 *
 * A plain box that replays or toggles is made focusable with `role="button"`, so Tab reaches it.
 */

const reduced = (): boolean => window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
const isKey = ( e: KeyboardEvent ): boolean => e.key === 'Enter' || e.key === ' ';

/** Elements the keyboard already reaches and activates on its own. */
const NATIVE = 'a[href], button, input, select, textarea, summary';
const FOCUSABLE = `${ NATIVE }, [tabindex]`;

/** How far around the block the pointer still pulls it, as a multiple of its half-size. */
const REACH = 1.6;

export function follow( el: HTMLElement ): void {
	const strength = Number.parseFloat( el.dataset.blFollow ?? '' ) || 12;
	const reset = () => {
		for ( const name of [ '--bl-px', '--bl-py', '--bl-mx', '--bl-my' ] ) el.style.removeProperty( name );
	};
	// Where the block rests, from layout offsets, which ignore transforms: a block that leans by
	// --bl-px (or sits mid-transition back) must not chase its own movement.
	const rest = () => {
		let x = 0;
		let y = 0;
		for ( let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null ) {
			x += n.offsetLeft;
			y += n.offsetTop;
		}
		return { left: x - window.scrollX, top: y - window.scrollY, width: el.offsetWidth, height: el.offsetHeight };
	};

	document.addEventListener( 'pointermove', ( e ) => {
		if ( reduced() || e.pointerType === 'touch' ) return;
		const r = rest();
		const { left, top } = r;
		const dx = ( e.clientX - ( left + r.width / 2 ) ) / ( ( r.width / 2 ) * REACH );
		const dy = ( e.clientY - ( top + r.height / 2 ) ) / ( ( r.height / 2 ) * REACH );
		if ( Math.abs( dx ) > 1 || Math.abs( dy ) > 1 ) {
			reset();
			return;
		}
		el.style.setProperty( '--bl-px', `${ ( dx * strength ).toFixed( 2 ) }px` );
		el.style.setProperty( '--bl-py', `${ ( dy * strength ).toFixed( 2 ) }px` );
		el.style.setProperty( '--bl-mx', `${ ( ( ( e.clientX - left ) / r.width ) * 100 ).toFixed( 1 ) }%` );
		el.style.setProperty( '--bl-my', `${ ( ( ( e.clientY - top ) / r.height ) * 100 ).toFixed( 1 ) }%` );
	}, { passive: true } );
	document.addEventListener( 'pointerleave', reset );
}

export function replay( el: HTMLElement ): void {
	const play = ( x: number, y: number ) => {
		el.removeAttribute( 'data-bl-play' );
		// Reading layout between the two writes is what restarts a running animation.
		void el.offsetWidth;
		el.style.setProperty( '--bl-cx', `${ Math.round( x ) }px` );
		el.style.setProperty( '--bl-cy', `${ Math.round( y ) }px` );
		el.setAttribute( 'data-bl-play', '' );
	};
	el.addEventListener( 'pointerdown', ( e ) => {
		const r = el.getBoundingClientRect();
		play( e.clientX - r.left, e.clientY - r.top );
	} );
	el.addEventListener( 'keydown', ( e ) => {
		if ( ! isKey( e ) || e.repeat ) return;
		// Space on a box made a button would scroll the page; a real button or link handles its own.
		if ( ! el.matches( NATIVE ) ) e.preventDefault();
		const r = el.getBoundingClientRect();
		play( r.width / 2, r.height / 2 );
	} );
}

/** The control that last switched each card, for Escape to return focus to. */
const opener = new WeakMap< HTMLElement, HTMLElement >();

/** Every control that switches one target, so they all report the same state. */
const controls = new WeakMap< HTMLElement, Set< HTMLElement > >();

/**
 * Switch the target on or off and tell every control of it. A control that flips says
 * aria-expanded (it opens its card) or aria-pressed (it is a switch); a `data-bl-set` control is
 * one option of a pair, pressed while the state is the one it sets.
 */
function setState( target: HTMLElement, on: boolean ): void {
	target.toggleAttribute( 'data-bl-active', on );
	for ( const c of controls.get( target ) ?? [] ) {
		if ( ! c.matches( 'a, button, [role="button"]' ) ) continue;
		const fixed = c.dataset.blSet;
		if ( fixed ) c.setAttribute( 'aria-pressed', String( ( fixed === 'on' ) === on ) );
		else if ( c.dataset.blToggle === 'card' && ! c.hasAttribute( 'data-bl-keep' ) ) c.setAttribute( 'aria-expanded', String( on ) );
		else c.setAttribute( 'aria-pressed', String( on ) );
	}
}

export function toggle( el: HTMLElement ): void {
	const card = el.dataset.blToggle === 'card' ? ( el.closest( '.bl-group--card' ) as HTMLElement | null ) : null;
	const target = card ?? el;
	const first = ! controls.has( target );
	if ( first ) controls.set( target, new Set() );
	controls.get( target )!.add( el );
	setState( target, target.hasAttribute( 'data-bl-active' ) );

	const flip = ( e: Event ) => {
		// A toggle is not a trip: an in-page link that toggles stays where it is.
		if ( el instanceof HTMLAnchorElement && ( el.getAttribute( 'href' ) ?? '#' ).startsWith( '#' ) ) e.preventDefault();
		const fixed = el.dataset.blSet;
		setState( target, fixed ? fixed === 'on' : ! target.hasAttribute( 'data-bl-active' ) );
		opener.set( target, el );
	};
	el.addEventListener( 'click', flip );
	if ( ! el.matches( 'a, button' ) ) {
		el.addEventListener( 'keydown', ( e ) => {
			if ( isKey( e ) ) {
				e.preventDefault();
				flip( e );
			}
		} );
	}

	// A card that opens closes again on Escape or a click outside — once per card, however many
	// controls it has. A kept one (`data-bl-keep` on any of its controls) is a mode, and stays.
	if ( card && first ) {
		const kept = () => [ ...( controls.get( card ) ?? [] ) ].some( ( c ) => c.hasAttribute( 'data-bl-keep' ) || c.dataset.blSet );
		document.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Escape' && card.hasAttribute( 'data-bl-active' ) && ! kept() ) {
				setState( card, false );
				opener.get( card )?.focus();
			}
		} );
		document.addEventListener( 'click', ( e ) => {
			if ( card.hasAttribute( 'data-bl-active' ) && ! kept() && ! card.contains( e.target as Node ) ) setState( card, false );
		} );
	}
}

const HANDLERS: Record< string, ( el: HTMLElement ) => void > = { follow, replay, toggle };

/** The interactions a press triggers: the block must be reachable by Tab, not only by a pointer. */
const PRESSED = new Set( [ 'replay', 'toggle' ] );

/**
 * A box that replays or toggles is a control, so Tab must reach it and a screen reader must call
 * it a button. A link or button already is one; a box holding its own links or buttons is left
 * alone, since a control may not wrap others, and those reach the keyboard themselves.
 */
function reachable( el: HTMLElement ): void {
	if ( el.matches( FOCUSABLE ) || el.querySelector( FOCUSABLE ) ) return;
	el.tabIndex = 0;
	if ( ! el.hasAttribute( 'role' ) ) el.setAttribute( 'role', 'button' );
}

/** Wire every block on the page that asks for an interaction. Safe to call again for new blocks. */
export function start( root: ParentNode = document ): void {
	root.querySelectorAll< HTMLElement >( '[data-bl-do]:not([data-bl-ready])' ).forEach( ( el ) => {
		el.setAttribute( 'data-bl-ready', '' );
		const names = ( el.dataset.blDo ?? '' ).split( /\s+/ );
		if ( names.some( ( n ) => PRESSED.has( n ) ) ) reachable( el );
		for ( const name of names ) HANDLERS[ name ]?.( el );
	} );
}

if ( typeof document !== 'undefined' && ! ( globalThis as { __blicksTest?: boolean } ).__blicksTest ) {
	if ( document.readyState === 'loading' ) document.addEventListener( 'DOMContentLoaded', () => start() );
	else start();
	// Blocks added after load, such as the cards Load more appends (resources/runtime/loop-more.ts).
	document.addEventListener( 'blicks:content', ( e ) => start( e.target as ParentNode ) );
}
