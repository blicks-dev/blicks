import { describe, expect, it } from 'vitest';
import { cleanIconSize, inlineFix, inlineFixes, toLabel } from './content';

describe( 'button content', () => {
	it( 'makes text and boxes inline, unlinks a box and switches an image to its inline form', () => {
		expect( inlineFix( { name: 'blicks/text', attributes: { tag: 'p' } } ) ).toEqual( { tag: 'span' } );
		expect( inlineFix( { name: 'blicks/box', attributes: { tag: 'div', href: '/x', linkLabel: 'Go' } } ) ).toEqual( { tag: 'span', href: '', linkTarget: '', rel: '', linkLabel: '' } );
		expect( inlineFix( { name: 'blicks/image', attributes: {} } ) ).toEqual( { inline: true } );
		expect( inlineFix( { name: 'blicks/icon', attributes: { icon: 'star' } } ) ).toBeNull();
		expect( inlineFix( { name: 'blicks/text', attributes: { tag: 'span' } } ) ).toBeNull();
	} );

	it( 'fixes nested blocks too', () => {
		const tree = [ { clientId: 'a', name: 'blicks/box', attributes: { tag: 'span' }, innerBlocks: [ { clientId: 'b', name: 'blicks/text', attributes: {} } ] } ];
		expect( inlineFixes( tree ) ).toEqual( [ { clientId: 'b', attributes: { tag: 'span' } } ] );
	} );

	it( 'keeps the first text and icon when going back to a label, and says when more would be lost', () => {
		const icon = { clientId: 'i', name: 'blicks/icon', attributes: { icon: 'map' } };
		const text = { clientId: 't', name: 'blicks/text', attributes: { content: 'Plan' } };
		expect( toLabel( [ icon, text ] ) ).toEqual( { text: 'Plan', icon: 'map', lossy: false } );
		expect( toLabel( [ { clientId: 'd', name: 'blicks/box', attributes: {} }, text ] ).lossy ).toBe( true );
	} );

	it( 'reads an icon size as a length, a bare number as pixels, anything else as unset', () => {
		expect( cleanIconSize( '18' ) ).toBe( '18px' );
		expect( cleanIconSize( '1.25em' ) ).toBe( '1.25em' );
		expect( cleanIconSize( 'calc(1em)' ) ).toBe( '' );
		expect( cleanIconSize( undefined ) ).toBe( '' );
	} );
} );
