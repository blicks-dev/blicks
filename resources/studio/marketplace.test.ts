import { describe, it, expect, vi } from 'vitest';
import { loadMarketplace, marketplaceGate, marketplaceSource, openMarketplace, toEntry, type MarketItem } from './marketplace';
import { sources, studioApi, STUDIO_API_VERSION } from './registry';

const item = ( slug: string, patch: Partial< MarketItem > = {} ): MarketItem => ( {
	slug,
	title: slug,
	tier: 'free',
	has_content: true,
	group: { slug: 'cards', name: 'Cards' },
	preview: { image: `https://example.com/${ slug }.png` },
	...patch,
} );

const parse = ( content: string ) => ( content ? [ { name: 'blicks/box', attributes: { content } } ] : [] );

describe( 'the Marketplace shelf while it is off', () => {
	/* Opt-in: no request and no preview frame until an administrator turns it on in Settings. */
	it( 'is off when the server says nothing', () => {
		delete ( globalThis as { blicksStudioSettings?: unknown } ).blicksStudioSettings;
		expect( marketplaceGate() ).toEqual( { enabled: false, settingsUrl: '' } );
	} );

	it( 'asks nothing of the marketplace and links an administrator to the switch', async () => {
		const fetch = vi.fn();
		const load = await marketplaceSource( fetch as never, parse as never, () => ( { enabled: false, settingsUrl: '/wp-admin/admin.php?page=blicks-settings' } ) ).load();

		expect( fetch ).not.toHaveBeenCalled();
		expect( load.entries ).toEqual( [] );
		expect( load.error ).toMatch( /Marketplace is off/ );
		expect( load.action ).toEqual( { label: 'Open Settings', href: '/wp-admin/admin.php?page=blicks-settings' } );
	} );

	it( 'tells an editor who cannot turn it on who can, with no link', async () => {
		const fetch = vi.fn();
		const load = await marketplaceSource( fetch as never, parse as never, () => ( { enabled: false, settingsUrl: '' } ) ).load();

		expect( fetch ).not.toHaveBeenCalled();
		expect( load.error ).toMatch( /administrator/ );
		expect( load.action ).toBeUndefined();
	} );

	it( 'fetches once it is on', async () => {
		( globalThis as { blicksStudioSettings?: unknown } ).blicksStudioSettings = { marketplace: { enabled: true, settingsUrl: '' } };
		const fetch = vi.fn().mockResolvedValue( { items: [ item( 'aurora' ) ], licensed: false, stale: null } );
		const load = await marketplaceSource( fetch as never, parse as never ).load();

		expect( fetch ).toHaveBeenCalledTimes( 1 );
		expect( load.entries ).toHaveLength( 1 );
		delete ( globalThis as { blicksStudioSettings?: unknown } ).blicksStudioSettings;
	} );
} );

describe( 'the Marketplace shelf', () => {
	it( 'lists built items, shelved under the remote row with their picture and kind', async () => {
		const fetch = vi.fn().mockResolvedValue( { items: [ item( 'aurora' ), item( 'draft', { has_content: false } ) ], licensed: false, stale: null } );
		const load = await loadMarketplace( fetch as never, parse as never );

		expect( fetch.mock.calls[ 0 ][ 0 ].path ).toBe( '/blicks/v1/marketplace/items?per_page=100' );
		expect( load.entries.map( ( e ) => e.id ) ).toEqual( [ 'marketplace:aurora' ] );
		expect( load.entries[ 0 ] ).toMatchObject( { source: 'dev', kind: 'Cards', tier: 'free', image: 'https://example.com/aurora.png', blocks: null } );
		expect( load.error ).toBeUndefined();
	} );

	/* The catalogue reads the same everywhere: a Pro item is visible but locked, never absent. */
	it( 'locks Pro items where Pro is not licensed, and opens them where it is', () => {
		const open = async () => ( { blocks: [] } );

		expect( toEntry( item( 'x', { tier: 'pro' } ), false, open ) ).toMatchObject( { locked: true, tier: 'pro' } );
		expect( toEntry( item( 'x', { tier: 'pro' } ), false, open ).open ).toBeUndefined();
		expect( toEntry( item( 'x', { tier: 'pro' } ), true, open ).locked ).toBeUndefined();
		expect( toEntry( item( 'x', { tier: 'pro' } ), true, open ).open ).toBe( open );
	} );

	/* A live preview: the built item's frame, else its design page; with what it is and how it moves. */
	it( 'carries the preview frame, excerpt and motion', () => {
		const open = async () => ( { blocks: [] } );
		const built = toEntry( item( 'x', { excerpt: 'A glow.', motion: 'animated', preview: { image: null, url: 'https://m.dev/x.html', frame: 'https://m.dev/x/?blicks_frame=1' } } ), true, open );
		expect( built ).toMatchObject( { frame: 'https://m.dev/x/?blicks_frame=1', excerpt: 'A glow.', motion: 'animated' } );
		expect( toEntry( item( 'y', { preview: { url: 'https://m.dev/y.html' } } ), true, open ).frame ).toBe( 'https://m.dev/y.html' );
		expect( toEntry( item( 'z', { preview: {} } ), true, open ).frame ).toBeUndefined();
	} );

	it( 'says how old a list is when it is the last good copy', async () => {
		const fetch = vi.fn().mockResolvedValue( { items: [ item( 'a' ) ], stale: '2026-10-31T10:00:00Z' } );
		const load = await loadMarketplace( fetch as never, parse as never );

		expect( load.entries ).toHaveLength( 1 );
		expect( load.error ).toMatch( /Showing what was fetched/ );
	} );

	it( 'names the failure and keeps an empty shelf when the proxy refuses', async () => {
		const load = await loadMarketplace( vi.fn().mockRejectedValue( { message: 'Can’t reach the marketplace right now.' } ) as never, parse as never );

		expect( load ).toEqual( { entries: [], error: 'Can’t reach the marketplace right now.' } );
	} );

	it( 'opens an item into blocks and the keyframes it carries', async () => {
		const glow = { slug: 'glow', label: 'Glow', steps: [ { offset: 0, declarations: { opacity: '0' } } ] };
		const fetch = vi.fn().mockResolvedValue( { content: '<!-- markup -->', keyframes: [ glow ] } );
		const opened = await openMarketplace( 'aurora', fetch as never, parse as never );

		expect( fetch.mock.calls[ 0 ][ 0 ].path ).toBe( '/blicks/v1/marketplace/items/aurora/content' );
		expect( opened.blocks ).toHaveLength( 1 );
		expect( opened.keyframes ).toEqual( [ glow ] );
	} );

	it( 'passes the marketplace’s own reason on when opening is refused', async () => {
		const fetch = vi.fn().mockRejectedValue( { message: 'A Blicks Pro licence is required.' } );

		await expect( openMarketplace( 'x', fetch as never, parse as never ) ).rejects.toThrow( 'A Blicks Pro licence is required.' );
	} );
} );

describe( 'registerSource (API 2)', () => {
	it( 'is published, since version 2', () => {
		expect( STUDIO_API_VERSION ).toBeGreaterThanOrEqual( 2 );
		expect( typeof studioApi.registerSource ).toBe( 'function' );
	} );

	it( 'refuses a source without a label or a loader, and keeps a good one', () => {
		const spy = vi.spyOn( console, 'error' ).mockImplementation( () => undefined );

		expect( sources.register( { id: 'x', label: 'X' } ) ).toBe( false );
		expect( sources.register( { id: 'y', load: async () => ( { entries: [] } ) } ) ).toBe( false );
		expect( sources.register( { id: 'z', label: 'Z', load: async () => ( { entries: [] } ) } ) ).toBe( true );
		expect( sources.list().map( ( s ) => s.id ) ).toContain( 'z' );

		sources.unregister( 'z' );
		spy.mockRestore();
	} );
} );
