/**
 * @vitest-environment jsdom
 *
 * A Button or Image whose link is bound to a Loop field saves an anchor (`href="#"`): the page
 * writes the item's address into the `a` (`Bindings`, selector `a`), so without one a card's
 * "View trip" was a button that went nowhere. Unbound blocks keep their markup (golden files).
 */
import { describe, expect, it } from 'vitest';
import { createBlock, parse, serialize } from '@wordpress/blocks';

import '@/block-library';

const bound = ( attr: string ) => ( { metadata: { bindings: { [ attr ]: { source: 'blicks/item', args: { key: 'url' } } } } } );

describe( 'a link bound to a Loop field', () => {
	it( 'makes a Button an anchor', () => {
		const html = serialize( [ createBlock( 'blicks/button', { uniqueId: 'a1b2c3d4', text: 'View trip', ...bound( 'url' ) } ) ] );

		expect( html ).toMatch( /<a [^>]*href="#"/ );
		expect( html ).not.toContain( '<button' );
		expect( parse( html )[ 0 ].isValid ).toBe( true );
	} );

	it( 'wraps an Image in an anchor', () => {
		const html = serialize( [ createBlock( 'blicks/image', { uniqueId: 'a1b2c3d4', url: 'https://example.com/a.jpg', ...bound( 'href' ) } ) ] );

		expect( html ).toMatch( /<a href="#"><img/ );
		expect( parse( html )[ 0 ].isValid ).toBe( true );
	} );

	it( 'leaves a typed address and an unbound Button as they were', () => {
		expect( serialize( [ createBlock( 'blicks/button', { uniqueId: 'a1b2c3d4', text: 'Go', url: 'https://example.com', ...bound( 'url' ) } ) ] ) ).toContain( 'href="https://example.com"' );
		expect( serialize( [ createBlock( 'blicks/button', { uniqueId: 'a1b2c3d4', text: 'Go' } ) ] ) ).toContain( '<button' );
	} );
} );
