/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	registerContext,
	unregisterContext,
	registeredContexts,
	resolveContexts,
	hasAncestorOfName,
} from './contexts';

/**
 * The registry that decides whether a conditional inspector section may show.
 *
 * Its failure modes all look the same from the outside — a section that should be there is not —
 * so the behaviours worth pinning are the ones that produce that silently: an unregistered
 * context, a predicate that throws, and a block with no parent.
 */

/** A `select` over a flat parent map, standing in for `core/block-editor`. */
function fakeSelect( tree: Record< string, { name: string; parent?: string } > ) {
	return () => ( {
		getBlockRootClientId: ( id: string ) => tree[ id ]?.parent ?? null,
		getBlockName: ( id: string ) => tree[ id ]?.name ?? null,
		getBlockAttributes: () => ( {} ),
	} );
}

afterEach( () => {
	unregisterContext( 'test/ctx' );
} );

describe( 'inspector contexts', () => {
	it( 'ships the two generic contexts', () => {
		expect( registeredContexts() ).toEqual(
			expect.arrayContaining( [ 'grid-parent', 'flex-parent' ] )
		);
	} );

	it( 'never meets a context nobody registered', () => {
		const met = resolveContexts( 'child', fakeSelect( { child: { name: 'acme/thing' } } ) );

		// The property that lets this plugin keep a section whose provider is inactive: it is
		// hidden, not broken.
		expect( met[ 'scene-parent' ] ).toBeUndefined();
		expect( Boolean( met[ 'scene-parent' ] ) ).toBe( false );
	} );

	it( 'contains a predicate that throws', () => {
		registerContext( 'test/ctx', () => {
			throw new Error( 'companion bug' );
		} );

		const met = resolveContexts( 'child', fakeSelect( { child: { name: 'acme/thing' } } ) );

		// A companion's bug must not be able to blank the whole inspector.
		expect( met[ 'test/ctx' ] ).toBe( false );
	} );

	it( 'reports false for every context when nothing is selected', () => {
		registerContext( 'test/ctx', () => true );

		expect( resolveContexts( undefined, fakeSelect( {} ) )[ 'test/ctx' ] ).toBe( false );
	} );

	it( 'replaces a re-registered id', () => {
		registerContext( 'test/ctx', () => true );
		registerContext( 'test/ctx', () => false );

		expect( resolveContexts( 'child', fakeSelect( { child: { name: 'x' } } ) )[ 'test/ctx' ] ).toBe( false );
		expect( registeredContexts().filter( ( id ) => id === 'test/ctx' ) ).toHaveLength( 1 );
	} );

	it( 'refuses a bad registration instead of throwing', () => {
		const spy = vi.spyOn( console, 'error' ).mockImplementation( () => {} );

		expect( registerContext( '', () => true ) ).toBe( false );
		expect( registerContext( 'test/ctx', 'not a function' ) ).toBe( false );

		spy.mockRestore();
	} );

	describe( 'hasAncestorOfName', () => {
		const tree = {
			item: { name: 'blicks/scene-text', parent: 'box' },
			box: { name: 'blicks/scene-box', parent: 'scene' },
			scene: { name: 'blicks/scene' },
			orphan: { name: 'blicks/scene-text' },
		};

		it( 'finds an ancestor at any depth, not just the parent', () => {
			const predicate = hasAncestorOfName( 'blicks/scene' );

			// Two levels up — the case a parent-only check would miss.
			expect( predicate( 'item', fakeSelect( tree ) as any ) ).toBe( true );
			expect( predicate( 'box', fakeSelect( tree ) as any ) ).toBe( true );
		} );

		it( 'is false for a block with no parent at all', () => {
			expect( hasAncestorOfName( 'blicks/scene' )( 'orphan', fakeSelect( tree ) as any ) ).toBe( false );
		} );

		it( 'is false when the ancestor is a different block', () => {
			expect( hasAncestorOfName( 'blicks/loop' )( 'item', fakeSelect( tree ) as any ) ).toBe( false );
		} );
	} );
} );
