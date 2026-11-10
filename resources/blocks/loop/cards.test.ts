import { describe, expect, it } from 'vitest';
import type { BlockNode } from '../../studio/mount';
import { countBindings, matchFields } from './cards';

const card = ( inner: BlockNode[], attributes: Record< string, unknown > = {} ): BlockNode => ( {
	name: 'blicks/box',
	attributes: { kind: 'card', uniqueId: 'abc12345', ...attributes },
	innerBlocks: inner,
} );
const heading = ( extra: Record< string, unknown > = {} ): BlockNode => ( { name: 'blicks/heading', attributes: { content: 'Title', uniqueId: 'h1', ...extra } } );
const text = (): BlockNode => ( { name: 'blicks/text', attributes: { content: 'Line' } } );
const key = ( node: BlockNode | undefined, attr: string ) => ( node?.attributes?.metadata as any )?.bindings?.[ attr ]?.args?.key;

describe( 'matchFields', () => {
	it( 'binds by name, each field once, top to bottom', () => {
		const bound = matchFields( card( [ heading(), text(), text() ] ), [ 'id', 'title', 'excerpt', 'price' ] );

		expect( key( bound.innerBlocks![ 0 ], 'content' ) ).toBe( 'title' );
		expect( key( bound.innerBlocks![ 1 ], 'content' ) ).toBe( 'excerpt' );
		expect( key( bound.innerBlocks![ 2 ], 'content' ) ).toBe( 'price' );
		expect( countBindings( bound ) ).toBe( 3 );
	} );

	it( 'gives the description to the body text, not a short label above it', () => {
		const label: BlockNode = { name: 'blicks/text', attributes: { content: 'NEWS' } };
		const body: BlockNode = { name: 'blicks/text', attributes: { content: 'A practical look at <em>handing</em> over a layout.' } };
		const bound = matchFields( card( [ label, heading(), body ] ), [ 'title', 'description' ] );

		expect( key( bound.innerBlocks![ 0 ], 'content' ) ).toBeUndefined();
		expect( key( bound.innerBlocks![ 2 ], 'content' ) ).toBe( 'description' );
	} );

	it( 'binds a picture with its alt text, and a button’s label and link', () => {
		const bound = matchFields( card( [ { name: 'blicks/image', attributes: {} }, { name: 'blicks/button', attributes: { text: 'View' } } ] ), [ 'name', 'photo', 'link' ] );

		expect( key( bound.innerBlocks![ 0 ], 'url' ) ).toBe( 'photo' );
		expect( key( bound.innerBlocks![ 0 ], 'alt' ) ).toBe( 'name' );
		expect( key( bound.innerBlocks![ 1 ], 'url' ) ).toBe( 'link' );
		expect( key( bound.innerBlocks![ 1 ], 'text' ) ).toBeUndefined();
	} );

	it( 'keeps an existing binding, leaves unmatched blocks typed, and drops uniqueIds', () => {
		const already = heading( { metadata: { bindings: { content: { source: 'blicks/item', args: { key: 'name' } } } } } );
		const bound = matchFields( card( [ already, text() ] ), [ 'name', 'title' ] );

		expect( key( bound.innerBlocks![ 0 ], 'content' ) ).toBe( 'name' );
		expect( bound.innerBlocks![ 1 ].attributes?.metadata ).toBeUndefined();
		expect( bound.attributes?.uniqueId ).toBeUndefined();
		expect( bound.innerBlocks![ 0 ].attributes?.uniqueId ).toBeUndefined();
	} );

	it( 'copies the card when there is no data yet', () => {
		const bound = matchFields( card( [ heading() ] ), [] );

		expect( countBindings( bound ) ).toBe( 0 );
		expect( bound.innerBlocks![ 0 ].attributes?.content ).toBe( 'Title' );
	} );
} );
