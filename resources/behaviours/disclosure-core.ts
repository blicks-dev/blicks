/**
 * The `disclosure` behaviour as plain functions: a button that shows and hides the element it
 * controls, after the WAI-ARIA disclosure pattern (not the `menu` role). The behaviour
 * (./disclosure.ts) calls them from Interactivity directives; they import nothing, so they are
 * tested without the runtime.
 *
 * A region is the element carrying `data-wp-interactive="blicks/disclosure"`, e.g. a menu item.
 * Its toggle is the first `button[aria-expanded][aria-controls]` inside it that belongs to no
 * nearer region, and the panel is the element the toggle's `aria-controls` names. The state is the
 * toggle's `aria-expanded`, which is what CSS keys the panel off, so there is one source of truth
 * and no class to keep in step.
 *
 * - Click on the toggle opens or closes. A panel opened by hover is pinned open by a click instead
 *   of closed, so a visitor who hovers and then clicks does not see it vanish.
 * - Esc closes the open panel and puts focus back on its toggle. It is handled before a dialog
 *   around it sees the key, so Esc in a drawer closes the open item first and the drawer second.
 *   A panel opened by hover, with focus elsewhere, closes on Esc too (WCAG 1.4.13): the region
 *   also listens on the document.
 * - Opened by a click inside an open modal dialog (a drawer's next screen covering the toggle),
 *   focus moves to the panel's `[data-bl-focus]` element, if it has one.
 * - Focus moving out of the region, or a click outside it, closes it.
 * - Opening a region closes its open siblings (the other items of the same menu).
 * - A `bl-intent` event (the `hover-intent` behaviour) opens or closes it; only a panel opened
 *   that way is closed that way.
 * - Inside an open modal dialog (a phone drawer) a disclosure is an accordion or a next screen: it
 *   stays as the visitor left it, so focus-out, outside clicks, hover and scrolling leave it alone.
 *
 * `bl:disclosure-open` / `bl:disclosure-close` are dispatched on the region, with the reason.
 */

export const REGION = '[data-wp-interactive="blicks/disclosure"]';

export type OpenSource = 'click' | 'hover' | 'api';
export type CloseReason = 'button' | 'esc' | 'focus' | 'outside' | 'hover' | 'sibling' | 'scroll' | 'api';

export function regionOf( el: Element | null | undefined ): HTMLElement | null {
	return ( el?.closest?.( REGION ) as HTMLElement | null ) ?? null;
}

/** The region's own toggle: not one belonging to a disclosure nested inside it. */
export function toggleOf( region: Element ): HTMLButtonElement | null {
	for ( const button of Array.from( region.querySelectorAll< HTMLButtonElement >( 'button[aria-expanded][aria-controls]' ) ) ) {
		if ( regionOf( button ) === region ) return button;
	}
	return null;
}

export function panelOf( region: Element ): HTMLElement | null {
	const id = toggleOf( region )?.getAttribute( 'aria-controls' );
	return id ? document.getElementById( id ) : null;
}

export const isOpen = ( region: Element ): boolean => toggleOf( region )?.getAttribute( 'aria-expanded' ) === 'true';

/** In an open modal dialog: a phone drawer, where a disclosure is an accordion. */
export const inModal = ( region: Element ): boolean => !! region.closest( 'dialog[open]' );

function emit( region: Element, type: 'open' | 'close', detail: Record< string, unknown > ): void {
	region.dispatchEvent( new CustomEvent( `bl:disclosure-${ type }`, { bubbles: true, detail } ) );
}

export function open( region: HTMLElement, source: OpenSource = 'api' ): void {
	const toggle = toggleOf( region );
	if ( ! toggle || isOpen( region ) ) return;

	for ( const other of Array.from( region.parentElement?.children ?? [] ) ) {
		if ( other !== region && other.matches( REGION ) && isOpen( other ) ) close( other as HTMLElement, 'sibling' );
	}

	toggle.setAttribute( 'aria-expanded', 'true' );
	region.setAttribute( 'data-bl-open', source );
	emit( region, 'open', { source } );
}

export function close( region: HTMLElement, reason: CloseReason = 'api' ): void {
	const toggle = toggleOf( region );
	if ( ! toggle || ! isOpen( region ) ) return;

	toggle.setAttribute( 'aria-expanded', 'false' );
	region.removeAttribute( 'data-bl-open' );
	emit( region, 'close', { reason } );
}

/** A click on the toggle. */
export function toggled( region: HTMLElement ): void {
	if ( ! isOpen( region ) ) {
		open( region, 'click' );
		if ( inModal( region ) ) panelOf( region )?.querySelector< HTMLElement >( '[data-bl-focus]' )?.focus();
		return;
	}
	// Opened by the pointer resting on it: the click keeps it open.
	if ( region.getAttribute( 'data-bl-open' ) === 'hover' && ! inModal( region ) ) {
		region.setAttribute( 'data-bl-open', 'click' );
		return;
	}
	close( region, 'button' );
}

/** Esc in the region: close it, focus its toggle, and keep the key from closing a dialog too. */
export function keyed( region: HTMLElement, e: KeyboardEvent ): void {
	if ( e.key !== 'Escape' || ! isOpen( region ) ) return;
	e.preventDefault();
	e.stopPropagation();
	close( region, 'esc' );
	toggleOf( region )?.focus();
}

/**
 * Esc anywhere on the page, for a panel the pointer opened while focus is elsewhere. Esc with focus
 * in the region is {@see keyed}'s, which stops it before it gets here.
 */
export function escaped( region: HTMLElement, e: KeyboardEvent ): void {
	if ( e.key !== 'Escape' || ! isOpen( region ) || inModal( region ) || region.contains( document.activeElement ) ) return;
	close( region, 'esc' );
}

/**
 * Focus left an element in the region. Closes only when it went somewhere else on the page: with
 * no `relatedTarget` (a click on plain text, the window losing focus) the outside click decides.
 */
export function focusedOut( region: HTMLElement, e: FocusEvent ): void {
	const next = e.relatedTarget as Node | null;
	if ( ! next || region.contains( next ) || inModal( region ) ) return;
	close( region, 'focus' );
}

export function clickedOutside( region: HTMLElement, e: Event ): void {
	const target = e.target as Node | null;
	if ( ! isOpen( region ) || ( target && region.contains( target ) ) || inModal( region ) ) return;
	close( region, 'outside' );
}

/** From the `hover-intent` behaviour: the pointer has rested on the region, or left it. */
export function intended( region: HTMLElement, e: Event ): void {
	if ( inModal( region ) ) return;
	const on = !! ( e as CustomEvent< { on?: boolean } > ).detail?.on;
	if ( on ) open( region, 'hover' );
	else if ( region.getAttribute( 'data-bl-open' ) === 'hover' ) close( region, 'hover' );
}

/** The page scrolled: a region marked `data-bl-close-on-scroll` closes. */
export function scrolled( region: HTMLElement ): void {
	if ( region.hasAttribute( 'data-bl-close-on-scroll' ) && ! inModal( region ) ) close( region, 'scroll' );
}
