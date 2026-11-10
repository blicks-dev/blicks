import { describe, it, expect } from 'vitest';
import { canGroup, canUngroup, flatten, groupAttributes, inTreeOrder, visibleRows } from './layer-model';
import type { BlockNode } from './mount';

const types = { getBlockType: ( name: string ) => ( { title: name.replace( 'blicks/', '' ) } ) };
const strip = ( html: string ) => html.replace( /<[^>]*>/g, '' );

const tree: BlockNode[] = [
	{ name: 'blicks/section', clientId: 's', innerBlocks: [
		{ name: 'blicks/box', clientId: 'b', attributes: { kind: 'card', metadata: { name: 'Hero' } }, innerBlocks: [
			{ name: 'blicks/heading', clientId: 'h', attributes: { content: 'Plan <b>the</b> week' } },
			{ name: 'blicks/text', clientId: 't', attributes: { content: 'Body', visibility: { mobile: true } } },
		] },
		{ name: 'blicks/image', clientId: 'i', attributes: { lock: { move: true, remove: true } } },
	] },
];

describe( 'flatten', () => {
	const rows = flatten( tree, types, strip );

	it( 'walks depth-first with parents and child counts', () => {
		expect( rows.map( ( r ) => [ r.id, r.depth, r.parent, r.children ] ) ).toEqual( [
			[ 's', 0, '', 2 ], [ 'b', 1, 's', 2 ], [ 'h', 2, 'b', 0 ], [ 't', 2, 'b', 0 ], [ 'i', 1, 's', 0 ],
		] );
	} );

	it( 'reads the name, snippet, lock and hidden screens', () => {
		const by = Object.fromEntries( rows.map( ( r ) => [ r.id, r ] ) );
		expect( by.b!.label ).toBe( 'Hero' );
		expect( by.b!.snippet ).toBe( 'card' );
		expect( by.h!.snippet ).toBe( 'Plan the week' );
		expect( by.t!.hidden ).toEqual( [ 'mobile' ] );
		expect( by.i!.locked ).toBe( true );
	} );
} );

describe( 'visibleRows', () => {
	const rows = flatten( tree, types, strip );

	it( 'leaves out what a collapsed row holds, and nothing else', () => {
		expect( visibleRows( rows, new Set( [ 'b' ] ), '' ).map( ( r ) => r.id ) ).toEqual( [ 's', 'b', 'i' ] );
	} );

	it( 'searches through collapsed groups', () => {
		expect( visibleRows( rows, new Set( [ 's' ] ), 'week' ).map( ( r ) => r.id ) ).toEqual( [ 'h' ] );
		expect( visibleRows( rows, new Set(), 'hero' ).map( ( r ) => r.id ) ).toEqual( [ 'b' ] );
		// A block whose style values matched shows too, in tree order, folded or not.
		expect( visibleRows( rows, new Set( [ 's' ] ), 'border', new Set( [ 'i', 's' ] ) ).map( ( r ) => r.id ) ).toEqual( [ 's', 'i' ] );
	} );
} );

describe( 'grouping', () => {
	const rows = flatten( tree, types, strip );
	const row = ( id: string ) => rows.find( ( r ) => r.id === id );

	it( 'groups two or more unlocked siblings only', () => {
		expect( canGroup( [ 'h', 't' ], rows ) ).toBe( true );
		expect( canGroup( [ 'h' ], rows ) ).toBe( false );
		expect( canGroup( [ 'h', 'i' ], rows ) ).toBe( false );
		expect( canGroup( [ 'b', 'i' ], rows ) ).toBe( false );
	} );

	it( 'ungroups a container with children', () => {
		expect( canUngroup( row( 'b' ) ) ).toBe( true );
		expect( canUngroup( row( 'h' ) ) ).toBe( false );
		expect( canUngroup( row( 's' ) ) ).toBe( false );
	} );

	it( 'keeps tree order whatever order the selection was made in', () => {
		expect( inTreeOrder( [ 't', 'h' ], rows ) ).toEqual( [ 'h', 't' ] );
	} );
} );

describe( 'groupAttributes', () => {
	it( 'starts the box inline inside a Button, plain elsewhere', () => {
		const inButton: BlockNode[] = [ { name: 'blicks/button', clientId: 'btn', innerBlocks: [
			{ name: 'blicks/box', clientId: 'x', innerBlocks: [ { name: 'blicks/text', clientId: 'a' }, { name: 'blicks/text', clientId: 'b' } ] },
		] } ];
		expect( groupAttributes( [ 'a', 'b' ], flatten( inButton, types, strip ) ) ).toEqual( { tag: 'span' } );
		expect( groupAttributes( [ 'h', 't' ], flatten( tree, types, strip ) ) ).toEqual( {} );
	} );
} );
