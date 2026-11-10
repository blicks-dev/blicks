// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { LIBRARY, findByUniqueId, keepStudioParam, readRefParam, readStudioParam, refParam, studioParam, withStudioParam } from './url';
import type { Mount } from './mount';

const mount = ( origin: string | null ): Mount => ( { blocks: [], mode: 'section', origin } as unknown as Mount );

describe( 'studioParam', () => {
	it( 'names the post block a mount was opened on', () => {
		expect( studioParam( { mount: mount( 'client-1' ), pending: null }, 'a1b2c3' ) ).toBe( 'a1b2c3' );
	} );

	it( 'says library while nothing is mounted', () => {
		expect( studioParam( { mount: null, pending: null }, null ) ).toBe( LIBRARY );
	} );

	it( 'writes nothing for a tree with no block behind it, or when the Studio is closed', () => {
		expect( studioParam( { mount: mount( null ), pending: null }, null ) ).toBeNull();
		expect( studioParam( null, 'a1b2c3' ) ).toBeNull();
	} );
} );

describe( 'withStudioParam', () => {
	const editor = 'https://site.test/wp-admin/post.php?post=12&action=edit';

	it( 'adds the parameter and keeps the editor’s own', () => {
		const next = new URL( withStudioParam( editor, 'a1b2c3' ) );

		expect( next.searchParams.get( 'post' ) ).toBe( '12' );
		expect( next.searchParams.get( 'action' ) ).toBe( 'edit' );
		expect( readStudioParam( next.search ) ).toBe( 'a1b2c3' );
	} );

	it( 'takes it out again', () => {
		expect( withStudioParam( withStudioParam( editor, 'a1b2c3' ), null ) ).toBe( editor );
	} );
} );

describe( 'findByUniqueId', () => {
	const tree = [
		{ name: 'blicks/section', attributes: { uniqueId: 'top' }, innerBlocks: [
			{ name: 'blicks/box', attributes: { uniqueId: 'deep' }, innerBlocks: [] },
		] },
		{ name: 'core/paragraph', attributes: {} },
	];

	it( 'finds a block at any depth', () => {
		expect( findByUniqueId( tree, 'top' )?.name ).toBe( 'blicks/section' );
		expect( findByUniqueId( tree, 'deep' )?.name ).toBe( 'blicks/box' );
	} );

	it( 'answers null for a block the post no longer has', () => {
		expect( findByUniqueId( tree, 'gone' ) ).toBeNull();
	} );
} );

describe( 'keepStudioParam', () => {
	const fakeHistory = () => {
		const written: Array< string | URL | null | undefined > = [];
		const history = { replaceState: ( _data: unknown, _unused: string, url?: string | URL | null ) => written.push( url ) } as unknown as History;
		return { history, written };
	};

	it( 'puts the parameter back on the editor’s bare post URL', () => {
		const { history, written } = fakeHistory();
		keepStudioParam( history, () => 'a1b2c3' );

		history.replaceState( { id: 12 }, 'Post 12', 'post.php?post=12&action=edit' );

		expect( readStudioParam( new URL( String( written[ 0 ] ) ).search ) ).toBe( 'a1b2c3' );
		expect( new URL( String( written[ 0 ] ) ).searchParams.get( 'post' ) ).toBe( '12' );
	} );

	it( 'leaves the URL alone while no Studio is open, and a state-only write alone', () => {
		const { history, written } = fakeHistory();
		let value: string | null = null;
		keepStudioParam( history, () => value );

		history.replaceState( {}, '', 'post.php?post=12&action=edit' );
		value = 'a1b2c3';
		history.replaceState( {}, '' );

		expect( written ).toEqual( [ 'post.php?post=12&action=edit', undefined ] );
	} );
} );

describe( 'stored trees (Studio API 3)', () => {
	const ref = { kind: 'template-part', id: 'theme//header' };

	it( 'names a stored tree by its mode and ref, whatever block it came from', () => {
		const stored = { ...mount( null ), mode: 'header', ref } as Mount;

		expect( studioParam( { mount: stored, pending: null }, 'a1b2c3' ) ).toBe( refParam( 'header', ref ) );
	} );

	it( 'reads back what it wrote, through an address', () => {
		const href = withStudioParam( 'https://site.test/wp-admin/site-editor.php?p=%2F', refParam( 'header', ref ) );

		expect( readRefParam( readStudioParam( new URL( href ).search ) ) ).toEqual( { mode: 'header', ref } );
	} );

	it( 'reads a block id or the library as no ref, and refuses anything that is not a mode and an object', () => {
		expect( readRefParam( 'a1b2c3' ) ).toBeNull();
		expect( readRefParam( LIBRARY ) ).toBeNull();
		expect( readRefParam( null ) ).toBeNull();
		expect( readRefParam( 'ref::{}' ) ).toBeNull();
		expect( readRefParam( 'ref:header:[1]' ) ).toBeNull();
		expect( readRefParam( 'ref:header:{oops' ) ).toBeNull();
	} );
} );
