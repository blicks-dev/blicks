/**
 * The `hover-intent` behaviour as plain functions: tells an element when a mouse pointer has
 * rested on it, and when it has really left, so a menu does not flash open as the pointer crosses
 * it nor snap shut as the pointer takes a diagonal path to its panel.
 *
 * It decides nothing itself: it dispatches `bl-intent` on the element, `detail.on` true or false,
 * and whatever listens (the `disclosure` behaviour) acts on it. Only a mouse counts. A touch or a
 * pen has no hover, and on touch screens the tap that follows would land on a panel the visitor
 * never asked for, so a panel only ever opens there from a tap on its toggle.
 *
 * `data-bl-delay` on the element is the rest time in milliseconds (default 150, at most 2000);
 * leaving waits at least 250 ms before it counts.
 */

const timers = new WeakMap< Element, ReturnType< typeof setTimeout > >();
const engaged = new WeakSet< Element >();

export const DEFAULT_DELAY = 150;
export const LEAVE_GRACE = 250;

export function delayOf( el: Element ): number {
	const raw = el.getAttribute( 'data-bl-delay' );
	const n = raw === null || raw === '' ? NaN : Number( raw );
	return Number.isFinite( n ) && n >= 0 ? Math.min( n, 2000 ) : DEFAULT_DELAY;
}

const isMouse = ( e: { pointerType?: string } ): boolean => ! e.pointerType || e.pointerType === 'mouse';

function stop( el: Element ): void {
	const timer = timers.get( el );
	if ( timer !== undefined ) clearTimeout( timer );
	timers.delete( el );
}

function fire( el: Element, on: boolean ): void {
	timers.delete( el );
	if ( on ) engaged.add( el );
	else engaged.delete( el );
	el.dispatchEvent( new CustomEvent( 'bl-intent', { detail: { on } } ) );
}

export function entered( el: Element, e: { pointerType?: string } ): void {
	if ( ! isMouse( e ) ) return;
	stop( el );
	if ( engaged.has( el ) ) return;
	timers.set( el, setTimeout( () => fire( el, true ), delayOf( el ) ) );
}

export function left( el: Element, e: { pointerType?: string } ): void {
	if ( ! isMouse( e ) ) return;
	stop( el );
	if ( ! engaged.has( el ) ) return;
	timers.set( el, setTimeout( () => fire( el, false ), Math.max( delayOf( el ), LEAVE_GRACE ) ) );
}
