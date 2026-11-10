/**
 * Load more for a paged Loop: the link the server rendered (src/Data/Pager.php), made to append
 * instead of reload. Enqueued only on pages with a Load more Loop.
 *
 * The link already works without this script: its address renders pages 1 to N + 1. Here it is
 * fetched instead of opened, and the items past the ones already shown are taken from the answer:
 *
 * - the new items are appended, and focus moves to the first of them;
 * - the count (`role="status"`) takes the answer's text, so a screen reader hears "Showing 12 of 34";
 * - the link takes the answer's next address, or goes once there is none;
 * - the address bar takes the fetched address with `replaceState`, so a reload or a return with
 *   Back shows the same list, without a history entry per load.
 *
 * With `data-bl-auto` the link is also pressed when it scrolls into view, three times at most, so
 * the footer below stays reachable. If a fetch fails the link is followed as a plain link.
 */

/** Loads by scrolling before the button has to be pressed again. */
const AUTO_LOADS = 3;

/** The item number in an item's id: `bl-loop-3fa2c1d8-7` → 7. */
const itemNumber = ( el: Element ): number => Number( /-(\d+)$/.exec( el.id )?.[ 1 ] ?? 0 );

export async function load( link: HTMLAnchorElement, fetcher: typeof fetch = fetch ): Promise< boolean > {
	const loop = link.closest< HTMLElement >( '[data-bl-loop]' );
	const list = loop?.querySelector< HTMLElement >( ':scope > .bl-loop__items' );
	if ( ! loop || ! list || link.getAttribute( 'aria-disabled' ) === 'true' ) return false;

	link.setAttribute( 'aria-disabled', 'true' );
	const status = loop.querySelector< HTMLElement >( ':scope > .bl-loop__more .bl-loop__status' );

	try {
		const response = await fetcher( link.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } } );
		if ( ! response.ok ) throw new Error( String( response.status ) );
		const page = new DOMParser().parseFromString( await response.text(), 'text/html' );
		// The id is letters and digits only (Pager::arg()); anything else could not have come from it.
		const next = page.querySelector< HTMLElement >( `[data-bl-loop="${ ( loop.dataset.blLoop ?? '' ).replace( /[^A-Za-z0-9]/g, '' ) }"]` );
		if ( ! next ) throw new Error( 'missing' );

		const last = Math.max( 0, ...Array.from( list.children, itemNumber ) );
		const added = Array.from( next.querySelectorAll( ':scope > .bl-loop__items > .bl-loop__item' ) )
			.filter( ( item ) => itemNumber( item ) > last )
			.map( ( item ) => list.appendChild( document.importNode( item, true ) ) as HTMLElement );

		const answer = next.querySelector( ':scope > .bl-loop__more' );
		if ( status ) status.textContent = answer?.querySelector( '.bl-loop__status' )?.textContent ?? status.textContent;
		const following = answer?.querySelector< HTMLAnchorElement >( '[data-bl-loop-more]' );

		history.replaceState( history.state, '', link.href.replace( /#.*$/, '' ) );
		if ( following ) {
			link.href = following.href;
			link.removeAttribute( 'aria-disabled' );
		} else {
			link.remove();
		}

		added[ 0 ]?.focus();
		// Blocks in the new cards that run interactions (resources/runtime/interactions.ts) start here.
		list.dispatchEvent( new CustomEvent( 'blicks:content', { bubbles: true } ) );
		return true;
	} catch {
		window.location.assign( link.href );
		return false;
	}
}

function wire( link: HTMLAnchorElement ): void {
	link.setAttribute( 'data-bl-ready', '' );
	link.setAttribute( 'role', 'button' );
	link.addEventListener( 'click', ( e ) => {
		if ( e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ) return;
		e.preventDefault();
		void load( link );
	} );
	// A link set as a button answers Space too, as a button does.
	link.addEventListener( 'keydown', ( e ) => {
		if ( e.key !== ' ' ) return;
		e.preventDefault();
		void load( link );
	} );

	if ( ! link.hasAttribute( 'data-bl-auto' ) || typeof IntersectionObserver === 'undefined' ) return;
	let loads = 0;
	const observer = new IntersectionObserver( ( entries ) => {
		if ( ! entries.some( ( entry ) => entry.isIntersecting ) || ! link.isConnected ) return;
		loads += 1;
		if ( loads >= AUTO_LOADS ) observer.disconnect();
		void load( link ).then( ( ok ) => {
			// Still in view after loading (short cards): look again for the next page.
			if ( ok && link.isConnected && loads < AUTO_LOADS ) {
				observer.unobserve( link );
				observer.observe( link );
			}
		} );
	}, { rootMargin: '0px 0px 200px 0px' } );
	observer.observe( link );
}

/** Wire every Load more link on the page. Safe to call again. */
export function start( root: ParentNode = document ): void {
	root.querySelectorAll< HTMLAnchorElement >( 'a[data-bl-loop-more]:not([data-bl-ready])' ).forEach( wire );
}

if ( typeof document !== 'undefined' && ! ( globalThis as { __blicksTest?: boolean } ).__blicksTest ) {
	if ( document.readyState === 'loading' ) document.addEventListener( 'DOMContentLoaded', () => start() );
	else start();
}
