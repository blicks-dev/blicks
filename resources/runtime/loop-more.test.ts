/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll( () => {
	( globalThis as { __blicksTest?: boolean } ).__blicksTest = true;
} );

/** A Loop as src/Data/LoopRenderer.php writes it in Load more mode, items `from`…`to`. */
const loop = ( from: number, to: number, next: number | null, total = 9 ) => `
<div class="bl-loop" id="bl-loop-ab12" data-bl-loop="ab12">
	<ul class="bl-loop__items" role="list">${ Array.from( { length: to - from + 1 }, ( _, i ) => `<li id="bl-loop-ab12-${ from + i }" tabindex="-1" class="bl-loop__item"><p>Item ${ from + i }</p></li>` ).join( '' ) }</ul>
	<div class="bl-loop__more is-align-center">
		<p class="bl-loop__status" role="status">Showing ${ to } of ${ total }</p>
		${ next ? `<a class="bl-loop__load" href="/shop/?loop-ab12=${ next }#bl-loop-ab12-${ to + 1 }" data-bl-loop-more>Load more</a>` : '' }
	</div>
</div>`;

const answer = ( html: string ) => vi.fn( async () => new Response( `<html><body>${ html }</body></html>`, { status: 200 } ) ) as unknown as typeof fetch;

describe( 'Load more', async () => {
	const { load, start } = await import( './loop-more' );

	it( 'appends only the new items, moves focus and updates the count', async () => {
		document.body.innerHTML = loop( 1, 3, 2 );
		const link = document.querySelector< HTMLAnchorElement >( '[data-bl-loop-more]' )!;
		const seen: Event[] = [];
		document.addEventListener( 'blicks:content', ( e ) => seen.push( e ) );

		// The next address renders pages 1 to 2: items 1–6.
		expect( await load( link, answer( loop( 1, 6, 3 ) ) ) ).toBe( true );

		const items = Array.from( document.querySelectorAll( '.bl-loop__item' ), ( li ) => li.id );
		expect( items ).toEqual( [ 1, 2, 3, 4, 5, 6 ].map( ( n ) => `bl-loop-ab12-${ n }` ) );
		expect( document.activeElement?.id ).toBe( 'bl-loop-ab12-4' );
		expect( document.querySelector( '[role="status"]' )?.textContent ).toBe( 'Showing 6 of 9' );
		expect( link.href ).toBe( `${ location.origin }/shop/?loop-ab12=3#bl-loop-ab12-7` );
		expect( link.hasAttribute( 'aria-disabled' ) ).toBe( false );
		expect( window.location.search ).toBe( '?loop-ab12=2' );
		expect( seen ).toHaveLength( 1 );
	} );

	it( 'removes the link after the last page', async () => {
		document.body.innerHTML = loop( 1, 6, 3 );
		const link = document.querySelector< HTMLAnchorElement >( '[data-bl-loop-more]' )!;

		await load( link, answer( loop( 1, 9, null ) ) );

		expect( document.querySelectorAll( '.bl-loop__item' ) ).toHaveLength( 9 );
		expect( document.querySelector( '[data-bl-loop-more]' ) ).toBeNull();
		expect( document.querySelector( '[role="status"]' )?.textContent ).toBe( 'Showing 9 of 9' );
	} );

	it( 'takes a page shown alone, past the stacking cap', async () => {
		document.body.innerHTML = loop( 1, 3, 2 );
		const link = document.querySelector< HTMLAnchorElement >( '[data-bl-loop-more]' )!;

		await load( link, answer( loop( 4, 6, 3 ) ) );

		expect( document.querySelectorAll( '.bl-loop__item' ) ).toHaveLength( 6 );
	} );

	it( 'follows the link when the answer has no such Loop', async () => {
		document.body.innerHTML = loop( 1, 3, 2 );
		const link = document.querySelector< HTMLAnchorElement >( '[data-bl-loop-more]' )!;
		const assign = vi.fn();
		const original = window.location;
		Object.defineProperty( window, 'location', { configurable: true, value: { ...original, assign } } );

		expect( await load( link, answer( '<p>Not found</p>' ) ) ).toBe( false );
		expect( assign ).toHaveBeenCalledWith( link.href );
		Object.defineProperty( window, 'location', { configurable: true, value: original } );
	} );

	it( 'wires each link once, as a button', () => {
		document.body.innerHTML = loop( 1, 3, 2 );
		start();
		start();
		const link = document.querySelector( '[data-bl-loop-more]' )!;
		expect( link.getAttribute( 'role' ) ).toBe( 'button' );
		expect( link.hasAttribute( 'data-bl-ready' ) ).toBe( true );
	} );
} );
