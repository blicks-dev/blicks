import { describe, it, expect } from 'vitest';
import {
	collectionFrom,
	collectionsOf,
	countsBySource,
	describe as describeTree,
	emptyKindFor,
	filterLibrary,
	industriesOf,
	isFiltered,
	isWritable,
	kindsOf,
	previewBars,
	shelve,
	NO_FILTER,
	type PatternEntry,
	type SourceResult,
} from './library';
import type { Collection } from './collections';

/**
 * A table of this test's own, not the shipped one.
 *
 * Every function that reads collections takes its table, so the model's behaviour can be pinned
 * without pinning the catalogue. A test that asserted "Funky has four patterns" would fail the day
 * a set grew, which is a release decision rather than a regression.
 */
const stub = ( id: string, name: string, industries: string[] ): Collection => ( {
	id,
	name,
	blurb: '',
	industries,
	palette: {
		ground: '#000',
		ink: '#fff',
		accent: '#f0f',
		accentInk: '#000',
		raised: '#333',
	},
	type: { display: '48px', heading: '24px', body: '16px', displayWeight: 700, tracking: '0' },
	radius: '8px',
	gutter: '64px',
} );

const TABLE: Collection[] = [
	stub( 'loud', 'Loud', [ 'Shop', 'Launch' ] ),
	stub( 'calm', 'Calm', [ 'Health' ] ),
];

const entry = (
	id: string,
	title: string,
	source: PatternEntry[ 'source' ],
	kind = '',
	collection?: string
): PatternEntry => ( { id, title, source, kind, collection, blocks: null } );

const shelf: PatternEntry[] = [
	entry( 'b1', 'Hero', 'builtin', 'Heroes', 'loud' ),
	entry( 'b2', 'Offer panel', 'builtin', 'Pricing', 'loud' ),
	entry( 'b3', 'Hero', 'builtin', 'Heroes', 'calm' ),
	entry( 's1', 'Agency banner', 'site', 'Heroes' ),
	entry( 'd1', 'Brutalist CTA', 'dev', 'Call to action' ),
];

const all = NO_FILTER;

describe( 'provenance', () => {
	/**
	 * The rule the whole library rests on: editing a built-in or a fetched pattern and saving makes
	 * a copy, so a plugin update can never overwrite someone's work.
	 */
	it( 'makes only this site’s own patterns writable in place', () => {
		expect( isWritable( entry( 's1', 'Mine', 'site' ) ) ).toBe( true );
		expect( isWritable( entry( 'b1', 'Shipped', 'builtin' ) ) ).toBe( false );
		expect( isWritable( entry( 'd1', 'Fetched', 'dev' ) ) ).toBe( false );
		expect( isWritable( entry( 'i1', 'Pasted', 'imported' ) ) ).toBe( false );
	} );

	/**
	 * Provenance and look are independent axes and must stay so. A site's own saved pattern is in
	 * no collection — that is not a gap, it is whatever its author made.
	 */
	it( 'leaves a pattern in no collection', () => {
		expect( collectionFrom( entry( 's1', 'Mine', 'site' ), TABLE ) ).toBeUndefined();
		expect( collectionFrom( shelf[ 0 ]!, TABLE )?.name ).toBe( 'Loud' );
	} );

	it( 'ignores a collection id no table declares', () => {
		expect( collectionFrom( entry( 'x', 'Orphan', 'dev', '', 'gone' ), TABLE ) ).toBeUndefined();
	} );
} );

describe( 'shelve', () => {
	it( 'puts the sources in shelf order whatever order they arrive in', () => {
		const results: SourceResult[] = [
			{ source: 'dev', entries: [ entry( 'd1', 'Fetched', 'dev' ) ] },
			{ source: 'builtin', entries: [ entry( 'b1', 'Shipped', 'builtin' ) ] },
			{ source: 'site', entries: [ entry( 's1', 'Mine', 'site' ) ] },
		];

		expect( shelve( results ).map( ( e ) => e.id ) ).toEqual( [ 'b1', 's1', 'd1' ] );
	} );

	/**
	 * blicks.dev is the only source that needs a network. When it fails the other three keep
	 * working — the shelf is never blank because one fetch did not come back.
	 */
	it( 'keeps the shelf when one source fails', () => {
		const results: SourceResult[] = [
			{ source: 'builtin', entries: [ entry( 'b1', 'Shipped', 'builtin' ) ] },
			{ source: 'dev', entries: [], error: 'Could not reach blicks.dev' },
		];

		expect( shelve( results ) ).toHaveLength( 1 );
	} );

	it( 'is empty when nothing reported at all', () => {
		expect( shelve( [] ) ).toEqual( [] );
	} );
} );

describe( 'countsBySource', () => {
	it( 'counts each source and the whole shelf', () => {
		expect( countsBySource( shelf ) ).toEqual( {
			all: 5,
			builtin: 3,
			site: 1,
			dev: 1,
			imported: 0,
		} );
	} );

	it( 'reports zero for a source with nothing on the shelf', () => {
		expect( countsBySource( [] ).imported ).toBe( 0 );
	} );
} );

describe( 'collectionsOf', () => {
	it( 'lists the sets present, with counts', () => {
		expect( collectionsOf( shelf, TABLE ).map( ( c ) => [ c.collection.id, c.count ] ) ).toEqual(
			[
				[ 'loud', 2 ],
				[ 'calm', 1 ],
			]
		);
	} );

	/**
	 * Table order, not count order. A collection is curated and its position is part of the
	 * curation; a rail that reordered itself as patterns were added would teach people the first
	 * set is the biggest rather than the one to start with.
	 */
	it( 'keeps the shipped order even when a later set has more', () => {
		const heavy = [
			entry( 'a', 'One', 'builtin', '', 'calm' ),
			entry( 'b', 'Two', 'builtin', '', 'calm' ),
			entry( 'c', 'Three', 'builtin', '', 'loud' ),
		];

		expect( collectionsOf( heavy, TABLE ).map( ( c ) => c.collection.id ) ).toEqual( [
			'loud',
			'calm',
		] );
	} );

	it( 'leaves out a set with nothing on the shelf', () => {
		expect( collectionsOf( [ shelf[ 0 ]! ], TABLE ).map( ( c ) => c.collection.id ) ).toEqual( [
			'loud',
		] );
	} );

	it( 'counts no collection for patterns in none', () => {
		expect( collectionsOf( [ entry( 's1', 'Mine', 'site' ) ], TABLE ) ).toEqual( [] );
	} );
} );

describe( 'industriesOf', () => {
	/** A collection claiming two industries contributes its patterns to both. */
	it( 'counts a pattern under every industry its set claims', () => {
		expect( industriesOf( shelf, TABLE ) ).toEqual( [
			{ industry: 'Launch', count: 2 },
			{ industry: 'Shop', count: 2 },
			{ industry: 'Health', count: 1 },
		] );
	} );

	/** Industry comes from the collection, so a pattern in none is counted nowhere. */
	it( 'ignores patterns in no collection', () => {
		expect( industriesOf( [ entry( 's1', 'Mine', 'site' ) ], TABLE ) ).toEqual( [] );
	} );
} );

describe( 'kindsOf', () => {
	it( 'lists only the kinds actually present, most used first', () => {
		expect( kindsOf( shelf ) ).toEqual( [
			{ kind: 'Heroes', count: 3 },
			{ kind: 'Call to action', count: 1 },
			{ kind: 'Pricing', count: 1 },
		] );
	} );

	/**
	 * Handed one collection's entries it reports that collection's kinds. This is what lets the
	 * rail say "1 hero" beside a Calm grid rather than the shelf-wide 3.
	 */
	it( 'counts within whatever it is handed', () => {
		const calm = shelf.filter( ( e ) => e.collection === 'calm' );

		expect( kindsOf( calm ) ).toEqual( [ { kind: 'Heroes', count: 1 } ] );
	} );

	it( 'leaves uncategorised patterns out of the kind list', () => {
		expect( kindsOf( [ entry( 'x', 'Loose', 'site' ) ] ) ).toEqual( [] );
	} );
} );

describe( 'filterLibrary', () => {
	it( 'shows everything by default', () => {
		expect( filterLibrary( shelf, all, TABLE ) ).toHaveLength( 5 );
	} );

	it( 'narrows to one source', () => {
		expect( filterLibrary( shelf, { ...all, source: 'builtin' }, TABLE ) ).toHaveLength( 3 );
	} );

	it( 'narrows to one collection', () => {
		expect(
			filterLibrary( shelf, { ...all, collection: 'loud' }, TABLE ).map( ( e ) => e.id )
		).toEqual( [ 'b1', 'b2' ] );
	} );

	it( 'narrows to one kind', () => {
		expect( filterLibrary( shelf, { ...all, kind: 'Heroes' }, TABLE ).map( ( e ) => e.id ) ).toEqual(
			[ 'b1', 'b3', 's1' ]
		);
	} );

	/** Industry is matched against the entry's COLLECTION, which is where it lives. */
	it( 'narrows by the industry its collection claims', () => {
		expect(
			filterLibrary( shelf, { ...all, industry: 'Health' }, TABLE ).map( ( e ) => e.id )
		).toEqual( [ 'b3' ] );
	} );

	/**
	 * A pattern in no collection has no industry, so an industry filter cannot reach it. That is
	 * why the rail must never present industry as the only way through the shelf.
	 */
	it( 'excludes a pattern in no collection from every industry', () => {
		expect( filterLibrary( shelf, { ...all, industry: 'Shop' }, TABLE ).map( ( e ) => e.id ) ).toEqual(
			[ 'b1', 'b2' ]
		);
	} );

	it( 'combines a collection and a kind', () => {
		expect(
			filterLibrary( shelf, { ...all, collection: 'loud', kind: 'Pricing' }, TABLE ).map(
				( e ) => e.id
			)
		).toEqual( [ 'b2' ] );
	} );

	it( 'combines a source and a kind', () => {
		expect(
			filterLibrary( shelf, { ...all, source: 'site', kind: 'Heroes' }, TABLE ).map( ( e ) => e.id )
		).toEqual( [ 's1' ] );
	} );

	it( 'searches the title and the kind, ignoring case and padding', () => {
		expect( filterLibrary( shelf, { ...all, query: '  HERO ' }, TABLE ).map( ( e ) => e.id ) ).toEqual(
			[ 'b1', 'b3', 's1' ]
		);
		expect( filterLibrary( shelf, { ...all, query: 'offer' }, TABLE ).map( ( e ) => e.id ) ).toEqual( [
			'b2',
		] );
	} );

	/** "funky" is a thing people type, and it is the name of a set rather than of any pattern. */
	it( 'searches the collection’s name too', () => {
		expect( filterLibrary( shelf, { ...all, query: 'calm' }, TABLE ).map( ( e ) => e.id ) ).toEqual( [
			'b3',
		] );
	} );

	it( 'finds nothing for a term the shelf does not carry', () => {
		expect( filterLibrary( shelf, { ...all, query: 'carousel' }, TABLE ) ).toEqual( [] );
	} );
} );

describe( 'isFiltered', () => {
	it( 'is false only when nothing is narrowed', () => {
		expect( isFiltered( all ) ).toBe( false );
		expect( isFiltered( { ...all, collection: 'loud' } ) ).toBe( true );
		expect( isFiltered( { ...all, industry: 'Shop' } ) ).toBe( true );
		expect( isFiltered( { ...all, source: 'site' } ) ).toBe( true );
		expect( isFiltered( { ...all, query: '   ' } ) ).toBe( false );
	} );
} );

describe( 'describe', () => {
	it( 'says the root and how many blocks, counting the whole tree', () => {
		expect(
			describeTree( [
				{
					name: 'blicks/section',
					innerBlocks: [
						{ name: 'blicks/box', innerBlocks: [ { name: 'blicks/heading' } ] },
					],
				},
			] )
		).toBe( 'section · 3 blocks' );
	} );

	it( 'says block, singular, for one', () => {
		expect( describeTree( [ { name: 'blicks/text' } ] ) ).toBe( 'text · 1 block' );
	} );

	it( 'says nothing for a tree it has not loaded yet', () => {
		expect( describeTree( null ) ).toBe( '' );
		expect( describeTree( [] ) ).toBe( '' );
	} );
} );

describe( 'emptyKindFor', () => {
	it( 'is not empty when something is showing', () => {
		expect( emptyKindFor( shelf, shelf, all ) ).toBe( 'none' );
	} );

	/**
	 * These need different sentences. First run gets the one instruction that fixes it forever; no
	 * results gets the search term back to edit.
	 */
	it( 'tells a first run apart from a dead-end search', () => {
		expect( emptyKindFor( [], [], all ) ).toBe( 'first-run' );
		expect( emptyKindFor( [], shelf, { ...all, query: 'carousel' } ) ).toBe( 'no-results' );
	} );

	it( 'knows a source is empty rather than the shelf', () => {
		expect( emptyKindFor( [], shelf, { ...all, source: 'site' } ) ).toBe( 'source-empty' );
	} );

	/**
	 * "Pricing, in Calm" is a third thing again: nothing is wrong, the shelf simply does not go
	 * that narrow. Before collections this fell through to `no-results` and offered to clear a
	 * search box nobody had typed in.
	 */
	it( 'knows a facet combination nobody has a pattern for', () => {
		expect( emptyKindFor( [], shelf, { ...all, collection: 'calm', kind: 'Pricing' } ) ).toBe(
			'filtered-out'
		);
		expect( emptyKindFor( [], shelf, { ...all, industry: 'Food' } ) ).toBe( 'filtered-out' );
	} );

	/** A typed term is why the person believes the grid is empty, so it answers first. */
	it( 'answers the search before the facets', () => {
		expect(
			emptyKindFor( [], shelf, { ...all, collection: 'calm', query: 'carousel' } )
		).toBe( 'no-results' );
	} );

	it( 'treats a search that found nothing as no-results even on an empty shelf', () => {
		expect( emptyKindFor( [], [], { ...all, query: 'carousel' } ) ).toBe( 'no-results' );
	} );
} );

describe( 'previewBars', () => {
	const section = ( children: number ): PatternEntry[ 'blocks' ] => [
		{
			name: 'blicks/section',
			innerBlocks: Array.from( { length: children }, () => ( { name: 'blicks/box' } ) ),
		},
	];

	/**
	 * A pattern is almost always one section wrapping the thing worth seeing, so drawing the roots
	 * would give every card the same single full-width bar.
	 */
	it( 'descends past a single wrapper to the children worth drawing', () => {
		expect( previewBars( section( 3 ) ) ).toHaveLength( 3 );
	} );

	it( 'marks the first bar as the lead', () => {
		const bars = previewBars( section( 3 ) );

		expect( bars[ 0 ]!.lead ).toBe( true );
		expect( bars[ 1 ]!.lead ).toBe( false );
	} );

	it( 'shares the width between what it draws', () => {
		const total = previewBars( section( 3 ) ).reduce( ( sum, bar ) => sum + bar.width, 0 );

		expect( total ).toBeLessThanOrEqual( 100 );
		expect( total ).toBeGreaterThan( 70 );
	} );

	it( 'caps how many it draws, so a long pattern stays legible', () => {
		expect( previewBars( section( 12 ) ) ).toHaveLength( 4 );
	} );

	/** Height carries how much each child holds, which is what distinguishes one card from another. */
	it( 'makes a fuller child taller', () => {
		const bars = previewBars( [
			{
				name: 'blicks/section',
				innerBlocks: [
					{ name: 'blicks/box', innerBlocks: [ { name: 'a' }, { name: 'b' } ] },
					{ name: 'blicks/box' },
				],
			},
		] );

		expect( bars[ 0 ]!.height ).toBeGreaterThan( bars[ 1 ]!.height );
	} );

	it( 'draws nothing for a tree it has not loaded', () => {
		expect( previewBars( null ) ).toEqual( [] );
		expect( previewBars( [] ) ).toEqual( [] );
	} );
} );
