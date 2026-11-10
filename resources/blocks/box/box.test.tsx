// @vitest-environment jsdom
/**
 * Box v2 saves one block per kind. Each kind's saved markup must parse back as a valid block (the
 * validation the editor runs on every load), and render the element the kind promises: an <hr> for
 * a divider, an empty aria-hidden box for a spacer, a text label for a badge.
 */

import { describe, expect, it } from 'vitest';
import { createBlock, parse, serialize } from '@wordpress/blocks';
import '@/block-library';
import { applyArrange, applyKind, BOX_KINDS, DEFAULT_ARRANGE } from './model';

function save( attributes: Record< string, unknown >, inner: any[] = [] ): string {
	return serialize( [ createBlock( 'blicks/box', { uniqueId: 'b0x00001', ...attributes }, inner ) ] );
}

function roundTrips( markup: string ): boolean {
	const [ block ] = parse( markup );
	return block?.isValid === true;
}

const kindAttributes = ( kind: ( typeof BOX_KINDS )[ number ] ) => {
	const look = applyKind( kind );
	return { kind, blicks: look.blicks, tag: look.tag, layers: look.layers, ...( kind === 'badge' ? { text: 'New' } : {} ) };
};

describe( 'Box kinds', () => {
	for ( const kind of BOX_KINDS ) {
		it( `saves a ${ kind } that validates on reload`, () => {
			expect( roundTrips( save( kindAttributes( kind ) ) ) ).toBe( true );
		} );
	}

	it( 'keeps a plain box free of a kind class', () => {
		expect( save( kindAttributes( 'plain' ) ) ).toContain( '<div class="bl-box bl-b0x00001"' );
	} );

	it( 'draws a divider as an hr and a spacer as an empty hidden box', () => {
		expect( save( kindAttributes( 'divider' ) ) ).toMatch( /<hr class="bl-box [^"]*bl-box--divider"/ );
		expect( save( kindAttributes( 'spacer' ) ) ).toMatch( /<div class="bl-box [^"]*bl-box--spacer"[^>]*aria-hidden="true"><\/div>/ );
	} );

	it( 'saves a badge as its text, and as the link when it has one', () => {
		expect( save( kindAttributes( 'badge' ) ) ).toMatch( /<span class="bl-box [^"]*bl-box--badge"[^>]*>New<\/span>/ );
		const linked = save( { ...kindAttributes( 'badge' ), href: 'https://example.com/' } );
		expect( linked ).toMatch( /<a class="bl-box [^"]*bl-box--badge"[^>]*href="https:\/\/example.com\/"[^>]*>New<\/a>/ );
		expect( roundTrips( linked ) ).toBe( true );
	} );

	it( 'saves a card with its children and the article element', () => {
		const markup = save( kindAttributes( 'card' ), [ createBlock( 'blicks/text', { content: 'Hello' } ) ] );
		expect( markup ).toMatch( /<article class="bl-box [^"]*bl-box--card/ );
		expect( markup ).toContain( 'Hello' );
		expect( roundTrips( markup ) ).toBe( true );
	} );

	it( 'marks a layered box so its children share one cell', () => {
		const { tree, layers } = applyArrange( {}, 'layers', DEFAULT_ARRANGE );
		const markup = save( { blicks: tree, layers } );
		expect( markup ).toContain( 'bl-box--layers' );
		expect( roundTrips( markup ) ).toBe( true );
	} );

	it( 'stretches a link over a container box', () => {
		const markup = save( { ...kindAttributes( 'card' ), href: 'https://example.com/', linkLabel: 'Read the guide' } );
		expect( markup ).toContain( '<a class="bl-box__link" href="https://example.com/" aria-label="Read the guide"></a>' );
		expect( roundTrips( markup ) ).toBe( true );
	} );
} );
