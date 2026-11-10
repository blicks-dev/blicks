/**
 * The `portal` behaviour as plain functions: an element that lives in the page and moves into a
 * dialog while that dialog is open, then back to where it was.
 *
 * A header's menu is the case. On wide screens its list sits in the bar, outside any dialog, so the
 * accessibility tree has a navigation and a list, not a dialog. On narrow screens a menu button
 * opens a drawer dialog, and the list moves into it for as long as it is open. The dialog keeps
 * doing what it does: focus trap, Esc, scroll lock, focus back to the opener.
 *
 * `data-bl-portal="<dialog id>"` names the dialog. Once the behaviour is running the element
 * carries `data-bl-portal-ready`, so CSS shows the button that opens the dialog only when the
 * element will follow it; without the script the element simply stays where it is.
 *
 * It listens for the dialog behaviour's `bl:dialog-open` and `bl:dialog-close`, which fire after
 * the dialog has opened (and moved focus) and after it has closed (and given focus back).
 */

const homes = new WeakMap< Element, Comment >();

export function moveIn( el: Element, dialog: Element ): void {
	if ( el.parentElement === dialog ) return;
	const home = document.createComment( 'bl-portal' );
	el.before( home );
	homes.set( el, home );
	dialog.append( el );
}

export function moveOut( el: Element ): void {
	const home = homes.get( el );
	if ( ! home?.isConnected ) return;
	home.replaceWith( el );
	homes.delete( el );
}

/** Start following the named dialog. Returns the cleanup, or nothing when there is no such dialog. */
export function follow( el: HTMLElement ): ( () => void ) | undefined {
	const id = el.getAttribute( 'data-bl-portal' ) ?? '';
	const dialog = id ? document.getElementById( id ) : null;
	if ( ! ( dialog instanceof HTMLDialogElement ) ) return undefined;

	const opened = ( e: Event ) => e.target === dialog && moveIn( el, dialog );
	const closed = ( e: Event ) => e.target === dialog && moveOut( el );
	dialog.addEventListener( 'bl:dialog-open', opened );
	dialog.addEventListener( 'bl:dialog-close', closed );
	el.setAttribute( 'data-bl-portal-ready', '' );
	if ( dialog.open ) moveIn( el, dialog );

	return () => {
		dialog.removeEventListener( 'bl:dialog-open', opened );
		dialog.removeEventListener( 'bl:dialog-close', closed );
		el.removeAttribute( 'data-bl-portal-ready' );
		moveOut( el );
	};
}
