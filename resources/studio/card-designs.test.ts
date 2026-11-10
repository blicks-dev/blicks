import { describe, expect, it } from 'vitest';
import type { BlockNode } from './mount';
import { builtinCards, findCard, siteCards, storeCard, storeCards } from './card-designs';

const card = ( inner: BlockNode[], attributes: Record< string, unknown > = {} ): BlockNode => ( {
	name: 'blicks/box',
	attributes: { kind: 'card', uniqueId: 'abc12345', ...attributes },
	innerBlocks: inner,
} );
const heading = ( extra: Record< string, unknown > = {} ): BlockNode => ( { name: 'blicks/heading', attributes: { content: 'Title', uniqueId: 'h1', ...extra } } );
const text = (): BlockNode => ( { name: 'blicks/text', attributes: { content: 'Line' } } );

describe( 'findCard', () => {
	it( 'takes the first card or panel out of a section', () => {
		const first = card( [ heading() ] );
		const tree: BlockNode[] = [ { name: 'blicks/section', innerBlocks: [ { name: 'blicks/box', innerBlocks: [ first, card( [ text() ] ) ] } ] } ];

		expect( findCard( tree ) ).toBe( first );
	} );

	it( 'skips an empty card and anything that is not one', () => {
		expect( findCard( [ card( [] ), { name: 'blicks/box', attributes: { kind: 'badge' }, innerBlocks: [ text() ] } ] ) ).toBeNull();
	} );
} );

describe( 'builtinCards', () => {
	it( 'offers each collection’s feature, offer and closing cards, not its hero', () => {
		const options = builtinCards();

		expect( options.length ).toBeGreaterThanOrEqual( 15 );
		expect( options.every( ( o ) => o.card && o.collection?.name && o.filters?.[ 0 ].label === o.collection.name ) ).toBe( true );
		expect( options.some( ( o ) => o.id.endsWith( ':hero' ) ) ).toBe( false );
		expect( new Set( options.map( ( o ) => o.title ) ) ).toEqual( new Set( [ 'Feature card', 'Offer panel', 'Call-to-action card' ] ) );
	} );
} );

describe( 'siteCards and storeCards', () => {
	it( 'lists only saved patterns that hold a card', () => {
		const parse = ( content: string ): BlockNode[] => ( content === 'with' ? [ card( [ heading() ] ) ] : [ heading() ] );
		const options = siteCards( [
			{ id: 'site:1', title: 'Team card', source: 'site', kind: '', blocks: null, content: 'with' },
			{ id: 'site:2', title: 'Just a heading', source: 'site', kind: '', blocks: null, content: 'without' },
		], parse );

		expect( options.map( ( o ) => o.title ) ).toEqual( [ 'Team card' ] );
	} );

	it( 'lists only the store’s cards, with Free / Pro and Animated filters', async () => {
		const [ free, pro ] = storeCards( [
			{ id: 'marketplace:a', title: 'Product grid', source: 'dev', kind: 'Cards', groupSlug: 'cards', blocks: null, tier: 'free', motion: 'animated', open: async () => ( { blocks: [ { name: 'blicks/section', innerBlocks: [ card( [ heading() ] ) ] } ] } ) },
			{ id: 'marketplace:b', title: 'Pro cards', source: 'dev', kind: 'Cards', groupSlug: 'cards', blocks: null, tier: 'pro', frame: 'https://showcase.test/b', locked: true, lockedReason: 'Part of Blicks Pro' },
			{ id: 'marketplace:c', title: 'Pill button', source: 'dev', kind: 'Buttons', groupSlug: 'buttons', blocks: null },
		] );

		expect( storeCards( [ { id: 'x', title: 'Hero', source: 'dev', kind: 'Heroes', blocks: null } ] ) ).toEqual( [] );
		expect( free.card ).toBeNull();
		expect( ( await free.load!() )?.name ).toBe( 'blicks/box' );
		expect( free.filters?.map( ( f ) => f.label ) ).toEqual( [ 'Free', 'Animated' ] );
		expect( pro ).toMatchObject( { locked: true, lockedReason: 'Part of Blicks Pro', frame: 'https://showcase.test/b' } );
		expect( pro.filters?.map( ( f ) => f.id ) ).toEqual( [ 'tier:pro' ] );
		expect( pro.load ).toBeUndefined();
	} );
} );

describe( 'storeCard', () => {
	it( 'takes a card from inside the item, else the item’s one root block', () => {
		const inner = card( [ heading() ] );
		const plain: BlockNode = { name: 'blicks/box', attributes: {}, innerBlocks: [ { name: 'blicks/box', innerBlocks: [ heading() ] } ] };

		expect( storeCard( [ { name: 'blicks/section', innerBlocks: [ inner ] } ] ) ).toBe( inner );
		expect( storeCard( [ plain ] ) ).toBe( plain );
		expect( storeCard( [ plain, plain ] ) ).toBeNull();
		expect( storeCard( [ { name: 'core/paragraph', innerBlocks: [] } ] ) ).toBeNull();
	} );
} );
