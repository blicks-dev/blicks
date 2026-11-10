/**
 * The `sticky-shrink` behaviour as plain functions: marks an element once the page has scrolled
 * past a point, so CSS can shrink a sticky header, or give a header that sits clear over the first
 * section its background back. Sticking itself is `position: sticky`, in CSS; this only says
 * "scrolled".
 *
 * `data-bl-after` on the element is how far, in pixels, the page scrolls before it counts
 * (default 8). While past it the element carries `data-bl-scrolled`. Reads are batched to one per
 * frame.
 *
 * `data-bl-hide` opts the element into hiding on the way down: it carries `data-bl-hidden` once the
 * page is past HIDE_AFTER and has moved more than HIDE_MOVE down since the last counted move, and
 * loses it on any counted move up, or while focus is inside it. Moving it out of view is CSS's.
 */

export const DEFAULT_AFTER = 8;
export const HIDE_AFTER = 80;
export const HIDE_MOVE = 6;

const queued = new WeakSet< Element >();
const last = new WeakMap< Element, number >();

export function afterOf( el: Element ): number {
	const n = Number( el.getAttribute( 'data-bl-after' ) );
	return Number.isFinite( n ) && n > 0 ? n : DEFAULT_AFTER;
}

/** Mark or unmark the element for a scroll position. */
export function update( el: Element, y: number ): void {
	el.toggleAttribute( 'data-bl-scrolled', y > afterOf( el ) );

	if ( ! el.hasAttribute( 'data-bl-hide' ) ) return;

	const from = last.get( el );

	if ( from === undefined ) {
		last.set( el, y );
		return;
	}

	if ( Math.abs( y - from ) <= HIDE_MOVE ) return;

	last.set( el, y );
	el.toggleAttribute( 'data-bl-hidden', y > from && y > HIDE_AFTER && ! el.contains( document.activeElement ) );
}

/** Focus came inside: the element shows again, and stays until the next move down. */
export function focused( el: Element ): void {
	el.removeAttribute( 'data-bl-hidden' );
}

/** The page scrolled: update on the next frame, once however many scroll events arrive. */
export function scrolled( el: Element ): void {
	if ( queued.has( el ) ) return;
	queued.add( el );
	requestAnimationFrame( () => {
		queued.delete( el );
		update( el, window.scrollY );
	} );
}
