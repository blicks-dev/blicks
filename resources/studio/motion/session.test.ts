// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BlockNode } from '../mount';
import type { Keyframes, LibraryAnimation } from './keyframes';
import * as session from './session';

const PATH = '/blicks/v1/design-system/animations';

const record = ( slug: string, opacity = '0' ): Keyframes => ( { slug, label: slug, steps: [ { offset: 0, declarations: { opacity } } ] } );
const custom = ( k: Keyframes ): LibraryAnimation => ( { ...k, name: `bl-anim-${ k.slug }`, builtin: false } );
const animated = ( slug: string ): BlockNode => ( {
	name: 'blicks/box',
	attributes: { blicks: { 'animation.name': { default: { base: `bl-anim-${ slug }` } } } },
} );

const style = (): string => document.getElementById( 'blicks-studio-keyframes' )?.textContent ?? '';

beforeEach( () => {
	( window as unknown as { blicksStudioSettings: unknown } ).blicksStudioSettings = { motion: { properties: [ 'opacity' ], canEdit: true } };
	session.end();
} );

describe( 'a Studio session’s keyframes', () => {
	it( 'brings a tree’s new keyframes in as drafts, and previews them', () => {
		session.begin( [ animated( 'aurora' ) ], [ record( 'aurora' ) ], [] );

		expect( session.drafts().map( ( d ) => d.keyframes.slug ) ).toEqual( [ 'aurora' ] );
		expect( style() ).toContain( '@keyframes bl-anim-aurora' );
	} );

	it( 'renames a clash in the tree it hands back', () => {
		const tree = session.begin( [ animated( 'jelly' ) ], [ record( 'jelly', '1' ) ], [ custom( record( 'jelly' ) ) ] );

		expect( ( tree[ 0 ]!.attributes as any ).blicks[ 'animation.name' ].default.base ).toBe( 'bl-anim-jelly-2' );
		expect( session.drafts().map( ( d ) => d.keyframes.slug ) ).toEqual( [ 'jelly-2' ] );
	} );

	it( '"use mine" points the tree back and drops their copy', () => {
		const tree = session.begin( [ animated( 'jelly' ) ], [ record( 'jelly', '1' ) ], [ custom( record( 'jelly' ) ) ] );
		const back = session.useMine( tree, session.arrivals()[ 0 ]! );

		expect( ( back[ 0 ]!.attributes as any ).blicks[ 'animation.name' ].default.base ).toBe( 'bl-anim-jelly' );
		expect( session.drafts() ).toEqual( [] );
	} );

	it( 'an edit to a library record replaces it, and the draft wins over the library', () => {
		session.begin( [], [], [ custom( record( 'glow' ) ) ] );
		session.put( record( 'glow', '0.5' ) );

		expect( session.drafts() ).toEqual( [ { keyframes: record( 'glow', '0.5' ), replaces: 'glow' } ] );
		expect( session.known() ).toEqual( [ record( 'glow', '0.5' ) ] );

		session.discard( 'glow' );
		expect( session.known() ).toEqual( [ record( 'glow' ) ] );
	} );
} );

describe( 'the door', () => {
	it( 'creates new records and patches edited ones, then forgets the drafts', async () => {
		session.begin( [], [], [ custom( record( 'glow' ) ) ] );
		session.put( record( 'glow', '0.5' ) );
		session.put( record( 'fresh' ) );

		const fetch = vi.fn( async ( _options: unknown ) => ( { library: [ custom( record( 'glow', '0.5' ) ), custom( record( 'fresh' ) ) ] } ) );

		await session.commit( fetch as never );

		expect( fetch.mock.calls.map( ( [ call ] ) => [ ( call as any ).method, ( call as any ).path ] ) ).toEqual( [
			[ 'PATCH', `${ PATH }/glow` ],
			[ 'POST', PATH ],
		] );
		expect( session.drafts() ).toEqual( [] );
		expect( session.known().map( ( k ) => k.slug ) ).toEqual( [ 'glow', 'fresh' ] );
	} );

	it( 'keeps what did not save when the server refuses', async () => {
		session.begin( [], [] , [] );
		session.put( record( 'one' ) );
		session.put( record( 'two' ) );

		const fetch = vi.fn().mockResolvedValueOnce( { library: [ custom( record( 'one' ) ) ] } ).mockRejectedValueOnce( new Error( 'full' ) );

		await expect( session.commit( fetch as never ) ).rejects.toThrow( 'full' );
		expect( session.drafts().map( ( d ) => d.keyframes.slug ) ).toEqual( [ 'two' ] );
	} );

	it( 'refuses without asking the server when this person cannot edit the library', async () => {
		( window as unknown as { blicksStudioSettings: unknown } ).blicksStudioSettings = { motion: { properties: [], canEdit: false } };
		session.begin( [ animated( 'aurora' ) ], [ record( 'aurora' ) ], [] );

		const fetch = vi.fn();

		await expect( session.commit( fetch as never ) ).rejects.toThrow();
		expect( fetch ).not.toHaveBeenCalled();
	} );

	it( 'has nothing to do without drafts', async () => {
		session.begin( [], [], [] );
		const fetch = vi.fn();

		await session.commit( fetch as never );
		expect( fetch ).not.toHaveBeenCalled();
	} );
} );
