import { dispatch, select } from '@wordpress/data';

/**
 * Group-style drill-down selection.
 *
 * A box is a group, and a click inside a group should select the GROUP first — the way it does in
 * every design tool. Reaching an item takes a second click, once its box already has focus.
 * Without this, clicking anywhere on a composition selects whatever small thing happens to be
 * under the cursor, and moving a box means hunting for a sliver of its background.
 *
 * Plain functions, not hooks: these run from pointer handlers that a block's `render` installs,
 * and `render` is shared with `save()` where hooks are illegal.
 */

/** The editor stamps every block wrapper with its clientId; that is how an item finds its box. */
function clientIdOf( element: Element | null ): string | null {
	return element?.getAttribute( 'data-block' ) ?? null;
}

export function boxElementFor( element: HTMLElement ): HTMLElement | null {
	return element.closest( '.bl-scene-box' );
}

/**
 * True when the box already has the selection — itself or anything inside it.
 *
 * "Anything inside it" matters: after drilling into one item, clicking a SIBLING item should go
 * straight to that sibling rather than bouncing back out to the box. The group stays open.
 */
export function isBoxActive( boxElement: HTMLElement | null ): boolean {
	if ( ! boxElement ) return false;
	const selected = ( select( 'core/block-editor' ) as any )?.getSelectedBlockClientId?.();
	if ( ! selected ) return false;
	if ( selected === clientIdOf( boxElement ) ) return true;
	return Boolean( boxElement.querySelector( `[data-block="${ selected }"]` ) );
}

/**
 * Marks an event as "already redirected to the box", so the box's own pointer handler knows to
 * take it even though it started on an item.
 *
 * A stamp on the event rather than a re-read of the store, because by the time the event reaches
 * the box the selection has ALREADY been changed by the redirect — the box would look active and
 * bail, and the first click would select but never drag.
 */
const REDIRECTED = '__blSceneRedirectedToBox';

export function markRedirected( event: { nativeEvent?: unknown } ): void {
	const native = ( event.nativeEvent ?? event ) as Record< string, unknown >;
	native[ REDIRECTED ] = true;
}

export function wasRedirected( event: { nativeEvent?: unknown } ): boolean {
	const native = ( event.nativeEvent ?? event ) as Record< string, unknown >;
	return native[ REDIRECTED ] === true;
}

/**
 * First click inside an unfocused box: select the box instead of the item.
 *
 * Returns true when the click was consumed that way, so the item's own gesture stands down and
 * lets the box take over.
 */
export function redirectToBox( event: React.PointerEvent< HTMLElement > ): boolean {
	const box = boxElementFor( event.currentTarget );
	if ( ! box || isBoxActive( box ) ) return false;

	const boxId = clientIdOf( box );
	if ( ! boxId ) return false;

	// Stop the editor focusing/selecting the item under the cursor.
	event.preventDefault();
	( dispatch( 'core/block-editor' ) as any ).selectBlock( boxId );
	markRedirected( event );
	return true;
}
