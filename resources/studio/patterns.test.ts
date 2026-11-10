import { describe, it, expect, vi } from 'vitest';
import {
	PatternError,
	listCategories,
	messageFor,
	loadSitePatterns,
	savePattern,
	withKinds,
	type Fetcher,
} from './patterns';

const serialize = ( blocks: { name: string }[] ): string =>
	blocks.map( ( b ) => `<!-- wp:${ b.name } /-->` ).join( '\n' );

/** Records what was sent, so the assertions are about the request rather than a mock's shape. */
function recorder( reply: unknown = { id: 7, title: { raw: 'Saved' } } ) {
	const calls: { path: string; method?: string; data?: unknown }[] = [];
	const fetch = ( ( options ) => {
		calls.push( options );

		return Promise.resolve( reply );
	} ) as Fetcher;

	return { fetch, calls };
}

describe( 'savePattern', () => {
	it( 'posts the serialized tree to core’s block endpoint', async () => {
		const { fetch, calls } = recorder();

		await savePattern(
			{ title: 'Black Friday hero', blocks: [ { name: 'blicks/section' } ], categoryId: null },
			fetch,
			serialize
		);

		expect( calls[ 0 ]!.path ).toBe( '/wp/v2/blocks' );
		expect( calls[ 0 ]!.method ).toBe( 'POST' );

		const data = calls[ 0 ]!.data as Record< string, unknown >;
		expect( data.title ).toBe( 'Black Friday hero' );
		expect( data.content ).toBe( '<!-- wp:blicks/section /-->' );
	} );

	/**
	 * A synced wp_block is a reference: change it and every post using it changes. That is a
	 * reusable block, a different feature with different expectations. "Save as pattern" means
	 * "give me a copy to start from".
	 */
	it( 'saves unsynced, so using it makes a copy', async () => {
		const { fetch, calls } = recorder();

		await savePattern(
			{ title: 'Hero', blocks: [ { name: 'blicks/section' } ], categoryId: null },
			fetch,
			serialize
		);

		const data = calls[ 0 ]!.data as { meta: Record< string, string > };
		expect( data.meta.wp_pattern_sync_status ).toBe( 'unsynced' );
	} );

	/** A draft pattern does not appear in the inserter, which makes "saved" a lie. */
	it( 'publishes rather than drafting', async () => {
		const { fetch, calls } = recorder();

		await savePattern(
			{ title: 'Hero', blocks: [ { name: 'blicks/section' } ], categoryId: null },
			fetch,
			serialize
		);

		expect( ( calls[ 0 ]!.data as { status: string } ).status ).toBe( 'publish' );
	} );

	it( 'attaches a category when one is chosen, and omits the field when not', async () => {
		const withCat = recorder();
		await savePattern(
			{ title: 'Hero', blocks: [ { name: 'blicks/section' } ], categoryId: 12 },
			withCat.fetch,
			serialize
		);
		expect( ( withCat.calls[ 0 ]!.data as Record< string, unknown > ).wp_pattern_category ).toEqual(
			[ 12 ]
		);

		const without = recorder();
		await savePattern(
			{ title: 'Hero', blocks: [ { name: 'blicks/section' } ], categoryId: null },
			without.fetch,
			serialize
		);
		expect(
			( without.calls[ 0 ]!.data as Record< string, unknown > )
		).not.toHaveProperty( 'wp_pattern_category' );
	} );

	it( 'returns what was saved, so the sheet can name it', async () => {
		const { fetch } = recorder( { id: 41, title: { raw: 'Black Friday hero' } } );

		const saved = await savePattern(
			{ title: 'Black Friday hero', blocks: [ { name: 'blicks/section' } ], categoryId: null },
			fetch,
			serialize
		);

		expect( saved ).toEqual( { id: 41, title: 'Black Friday hero' } );
	} );

	/** Both of these produce a pattern that exists and is useless, with nothing to explain it. */
	it( 'refuses an empty name before touching the network', async () => {
		const { fetch, calls } = recorder();

		await expect(
			savePattern(
				{ title: '   ', blocks: [ { name: 'blicks/section' } ], categoryId: null },
				fetch,
				serialize
			)
		).rejects.toThrow( PatternError );

		expect( calls ).toHaveLength( 0 );
	} );

	it( 'refuses an empty canvas before touching the network', async () => {
		const { fetch, calls } = recorder();

		await expect(
			savePattern( { title: 'Hero', blocks: [], categoryId: null }, fetch, serialize )
		).rejects.toThrow( /nothing on the canvas/ );

		expect( calls ).toHaveLength( 0 );
	} );

	it( 'trims the name it saves', async () => {
		const { fetch, calls } = recorder();

		await savePattern(
			{ title: '  Hero  ', blocks: [ { name: 'blicks/section' } ], categoryId: null },
			fetch,
			serialize
		);

		expect( ( calls[ 0 ]!.data as { title: string } ).title ).toBe( 'Hero' );
	} );
} );

describe( 'listCategories', () => {
	it( 'asks for the fields it needs and nothing else', async () => {
		const { fetch, calls } = recorder( [ { id: 3, name: 'Heroes' } ] );

		const found = await listCategories( fetch );

		expect( calls[ 0 ]!.path ).toContain( '/wp/v2/wp_pattern_category' );
		expect( calls[ 0 ]!.path ).toContain( '_fields=id,name' );
		expect( found ).toEqual( [ { id: 3, name: 'Heroes' } ] );
	} );
} );

describe( 'messageFor', () => {
	/**
	 * `apiFetch` rejects with the REST body, not an `Error`. Treating it as one puts
	 * `[object Object]` in front of the user.
	 */
	it( 'reads a REST error body as well as an Error', () => {
		expect( messageFor( new Error( 'boom' ) ) ).toBe( 'boom' );
		expect( messageFor( { code: 'rest_forbidden', message: 'Sorry, you are not allowed.' } ) ).toBe(
			'Sorry, you are not allowed.'
		);
		expect( messageFor( 'plain' ) ).toBe( 'plain' );
	} );
} );

describe( 'loadSitePatterns', () => {
	/**
	 * Shaped as core actually replies, which is the whole point of this fixture: the sync status
	 * comes back TOP-LEVEL, while `meta` carries only `footnotes`. Writing it under `meta` here
	 * would make the suite agree with a bug.
	 */
	const post = ( id: number, title: string, sync: string ) => ( {
		id,
		title: { raw: title },
		content: { raw: `<!-- wp:blicks/section /-->` },
		meta: { footnotes: '' },
		wp_pattern_sync_status: sync,
		wp_pattern_category: [],
	} );

	it( 'takes the unsynced ones and leaves reusable blocks alone', async () => {
		const { fetch } = recorder( [
			post( 1, 'Hero', 'unsynced' ),
			post( 2, 'Shared footer', '' ),
			post( 3, 'Pricing', 'unsynced' ),
		] );

		const result = await loadSitePatterns( fetch );

		expect( result.entries.map( ( e ) => e.title ) ).toEqual( [ 'Hero', 'Pricing' ] );
	} );

	it( 'keeps the markup and leaves the tree unparsed', async () => {
		const { fetch } = recorder( [ post( 1, 'Hero', 'unsynced' ) ] );

		const [ entry ] = ( await loadSitePatterns( fetch ) ).entries;

		expect( entry!.blocks ).toBeNull();
		expect( entry!.content ).toContain( 'blicks/section' );
		expect( entry!.id ).toBe( 'site:1' );
	} );

	it( 'asks in edit context, or the raw markup is not returned', async () => {
		const { fetch, calls } = recorder( [] );

		await loadSitePatterns( fetch );

		expect( calls[ 0 ]!.path ).toContain( 'context=edit' );
	} );

	/**
	 * The field is top-level in a response and `meta` in a request. Asking for `meta` and reading
	 * `meta` is the mistake that makes this source silently empty, so the request is pinned.
	 */
	it( 'asks for the sync status as a top-level field', async () => {
		const { fetch, calls } = recorder( [] );

		await loadSitePatterns( fetch );

		expect( calls[ 0 ]!.path ).toContain( 'wp_pattern_sync_status' );
	} );

	/**
	 * Core computes the top-level status from meta while preparing the response, and `_fields`
	 * filtering runs first — so dropping `meta` from the field list returns an empty status for
	 * every pattern and empties this source. Nothing in the code reads `meta`, which is exactly why
	 * a tidy-up would remove it.
	 */
	it( 'keeps meta in the field list, which the status is computed from', async () => {
		const { fetch, calls } = recorder( [] );

		await loadSitePatterns( fetch );

		expect( calls[ 0 ]!.path ).toMatch( /_fields=[^&]*\bmeta\b/ );
	} );

	it( 'is not fooled by a sync status hidden under meta', async () => {
		const { fetch } = recorder( [
			{
				id: 9,
				title: { raw: 'Looks unsynced' },
				content: { raw: '' },
				meta: { wp_pattern_sync_status: 'unsynced' },
			},
		] );

		expect( ( await loadSitePatterns( fetch ) ).entries ).toEqual( [] );
	} );

	/** One source failing must not take the shelf with it. */
	it( 'reports a failure as a result rather than throwing', async () => {
		const fetch = ( () =>
			Promise.reject( { message: 'Sorry, you are not allowed.' } ) ) as Fetcher;

		const result = await loadSitePatterns( fetch );

		expect( result.entries ).toEqual( [] );
		expect( result.error ).toBe( 'Sorry, you are not allowed.' );
	} );
} );

describe( 'withKinds', () => {
	it( 'names the category a pattern files under', () => {
		const result = withKinds(
			{
				source: 'site',
				entries: [
					{
						id: 'site:1',
						title: 'Hero',
						source: 'site',
						kind: '',
						blocks: null,
						categoryIds: [ 7 ],
					},
					{ id: 'site:2', title: 'Loose', source: 'site', kind: '', blocks: null },
				],
			},
			[ { id: 7, name: 'Heroes' } ]
		);

		expect( result.entries.map( ( e ) => e.kind ) ).toEqual( [ 'Heroes', '' ] );
	} );

	it( 'leaves a pattern uncategorised when its term is unknown', () => {
		const result = withKinds(
			{
				source: 'site',
				entries: [
					{
						id: 'site:1',
						title: 'Hero',
						source: 'site',
						kind: '',
						blocks: null,
						categoryIds: [ 99 ],
					},
				],
			},
			[ { id: 7, name: 'Heroes' } ]
		);

		expect( result.entries[ 0 ]!.kind ).toBe( '' );
	} );
} );
