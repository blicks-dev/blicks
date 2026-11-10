import { describe, expect, it } from 'vitest';
import { ITEM, LIST, indent, itemAbove, levelOf, mergeUp, outdent, pastedLines, stepOut, type ListActions, type ListMakers, type ListStore } from './editing';

/** A block tree in memory, with the editor selectors and actions the operations use. */
interface Node { id: string; name: string; attributes: Record< string, any >; parent: string | null; children: string[] }

function tree( spec: any[] ) {
	const nodes = new Map< string, Node >();
	const root: string[] = [];
	let seq = 0;
	const add = ( name: string, attributes: any, parent: string | null, id?: string ) => {
		const node = { id: id ?? `n${ ++seq }`, name, attributes: { ...attributes }, parent, children: [] };
		nodes.set( node.id, node );
		( parent ? nodes.get( parent )!.children : root ).push( node.id );
		return node.id;
	};
	// `[ 'a', [ 'b' ] ]` is item a, with an inner list holding item b.
	const build = ( items: any[], list: string ) => {
		for ( let i = 0; i < items.length; i++ ) {
			if ( Array.isArray( items[ i ] ) ) continue;
			const id = add( ITEM, { content: items[ i ] }, list, items[ i ] );
			if ( Array.isArray( items[ i + 1 ] ) ) build( items[ i + 1 ], add( LIST, { nested: true }, id ) );
		}
	};
	const outer = add( LIST, { kind: 'numbers', uniqueId: 'abc', gap: 'roomy' }, null, 'L' );
	build( spec, outer );

	const order = ( id?: string | null ) => ( id == null ? root : nodes.get( id )?.children ?? [] );
	const detach = ( id: string ) => {
		const from = order( nodes.get( id )!.parent );
		from.splice( from.indexOf( id ), 1 );
	};
	const s: ListStore = {
		getBlockName: ( id ) => nodes.get( id )?.name ?? null,
		getBlockRootClientId: ( id ) => nodes.get( id )?.parent ?? null,
		getBlockOrder: ( id ) => [ ...order( id ) ],
		getBlockAttributes: ( id ) => nodes.get( id )?.attributes ?? null,
		getBlock: ( id ) => ( { clientId: id } ),
	};
	let caret: [ string, number ] | null = null;
	const a: ListActions = {
		insertBlock: ( block, index, rootId ) => {
			const node = nodes.get( block.clientId )!;
			if ( node.parent !== undefined ) detach( node.id );
			node.parent = rootId ?? null;
			order( rootId ).splice( index, 0, node.id );
		},
		moveBlocksToPosition: ( ids, _from, to, index ) => {
			ids.forEach( ( id, k ) => {
				detach( id );
				nodes.get( id )!.parent = to;
				order( to ).splice( index + k, 0, id );
			} );
		},
		removeBlock: ( id ) => { detach( id ); nodes.delete( id ); },
		// Removed blocks stay known by id, as `getBlock` snapshots do, so they can be inserted again.
		removeBlocks: ( ids ) => ids.forEach( ( id ) => { detach( id ); ( nodes.get( id ) as any ).parent = undefined; } ),
		updateBlockAttributes: ( id, attributes ) => Object.assign( nodes.get( id )!.attributes, attributes ),
		selectionChange: ( id, _key, start ) => { caret = [ id, start ]; },
	};
	const make: ListMakers = {
		list: ( attributes, inner = [] ) => {
			const id = add( LIST, attributes, null );
			inner.forEach( ( b: any ) => { nodes.get( b.clientId )!.parent = id; nodes.get( id )!.children.push( b.clientId ); } );
			return { clientId: id };
		},
		text: () => ( { clientId: add( 'blicks/text', {}, null, 'T' ) } ),
	};
	/** The document as nested arrays of item contents — easy to read in an assertion. */
	const shape = ( list = 'L' ): any[] => order( list ).flatMap( ( id ) => {
		const inner = order( id ).find( ( c ) => nodes.get( c )!.name === LIST );
		return inner ? [ nodes.get( id )!.attributes.content, shape( inner ) ] : [ nodes.get( id )!.attributes.content ];
	} );
	const top = () => root.map( ( id ) => ( nodes.get( id )!.name === LIST ? shape( id ) : nodes.get( id )!.name ) );
	return { s, a, make, shape, top, nodes, caret: () => caret };
}

describe( 'Tab', () => {
	it( 'moves an item into the previous item’s inner list, making one at the outer list’s kind', () => {
		const t = tree( [ 'a', 'b', 'c' ] );
		expect( indent( t.s, t.a, t.make, 'b' ) ).toBe( true );
		expect( t.shape() ).toEqual( [ 'a', [ 'b' ], 'c' ] );
		const inner = t.s.getBlockOrder( 'a' )[ 0 ];
		expect( t.s.getBlockAttributes( inner ) ).toEqual( { kind: 'numbers', nested: true } );
	} );

	it( 'joins the end of an inner list that is already there', () => {
		const t = tree( [ 'a', [ 'x' ], 'b' ] );
		indent( t.s, t.a, t.make, 'b' );
		expect( t.shape() ).toEqual( [ 'a', [ 'x', 'b' ] ] );
	} );

	it( 'does nothing for the first item of a list', () => {
		const t = tree( [ 'a', 'b' ] );
		expect( indent( t.s, t.a, t.make, 'a' ) ).toBe( false );
		expect( t.shape() ).toEqual( [ 'a', 'b' ] );
	} );
} );

describe( 'Shift+Tab', () => {
	it( 'moves an item out after its parent, taking the items below it as children', () => {
		const t = tree( [ 'a', [ 'x', 'y', 'z' ], 'b' ] );
		expect( outdent( t.s, t.a, t.make, 'y' ) ).toBe( true );
		expect( t.shape() ).toEqual( [ 'a', [ 'x' ], 'y', [ 'z' ], 'b' ] );
	} );

	it( 'removes an inner list it leaves empty', () => {
		const t = tree( [ 'a', [ 'x' ], 'b' ] );
		outdent( t.s, t.a, t.make, 'x' );
		expect( t.shape() ).toEqual( [ 'a', 'x', 'b' ] );
		expect( t.s.getBlockOrder( 'a' ) ).toEqual( [] );
	} );

	it( 'does nothing at the top level', () => {
		const t = tree( [ 'a' ] );
		expect( outdent( t.s, t.a, t.make, 'a' ) ).toBe( false );
	} );

	it( 'counts levels', () => {
		const t = tree( [ 'a', [ 'x', [ 'deep' ] ] ] );
		expect( [ levelOf( t.s, 'a' ), levelOf( t.s, 'x' ), levelOf( t.s, 'deep' ) ] ).toEqual( [ 1, 2, 3 ] );
	} );
} );

describe( 'Enter on an empty item', () => {
	it( 'steps out one level when nested', () => {
		const t = tree( [ 'a', [ 'x', '' ] ] );
		expect( stepOut( t.s, t.a, t.make, '' ) ).toBe( '' );
		expect( t.shape() ).toEqual( [ 'a', [ 'x' ], '' ] );
	} );

	it( 'leaves the list as a Text when it is the last item', () => {
		const t = tree( [ 'a', 'b', '' ] );
		expect( stepOut( t.s, t.a, t.make, '' ) ).toBe( 'T' );
		expect( t.top() ).toEqual( [ [ 'a', 'b' ], 'blicks/text' ] );
	} );

	it( 'splits the list around the Text when items follow, keeping the list’s settings but not its id', () => {
		const t = tree( [ 'a', '', 'b', 'c' ] );
		stepOut( t.s, t.a, t.make, '' );
		expect( t.top() ).toEqual( [ [ 'a' ], 'blicks/text', [ 'b', 'c' ] ] );
		const second = t.s.getBlockOrder( null )[ 2 ];
		expect( t.s.getBlockAttributes( second ) ).toEqual( { kind: 'numbers', gap: 'roomy' } );
	} );

	it( 'replaces a list it empties', () => {
		const t = tree( [ '' ] );
		stepOut( t.s, t.a, t.make, '' );
		expect( t.top() ).toEqual( [ 'blicks/text' ] );
	} );
} );

describe( 'Backspace at the start of an item', () => {
	const len = ( html: string ) => html.replace( /<[^>]+>/g, '' ).length;

	it( 'joins the item above, with the caret where they meet', () => {
		const t = tree( [ 'Sun', 'screen', 'c' ] );
		expect( mergeUp( t.s, t.a, t.make, 'screen', len ) ).toBe( true );
		expect( t.shape() ).toEqual( [ 'Sunscreen', 'c' ] );
		expect( t.caret() ).toEqual( [ 'Sun', 3 ] );
	} );

	it( 'joins the deepest last item above, not its parent', () => {
		const t = tree( [ 'a', [ 'x', [ 'deep' ] ], 'b' ] );
		expect( itemAbove( t.s, 'b' ) ).toBe( 'deep' );
		mergeUp( t.s, t.a, t.make, 'b', len );
		expect( t.shape() ).toEqual( [ 'a', [ 'x', [ 'deepb' ] ] ] );
	} );

	it( 'carries its children into the item it joins', () => {
		const t = tree( [ 'a', 'b', [ 'y' ] ] );
		mergeUp( t.s, t.a, t.make, 'b', len );
		expect( t.shape() ).toEqual( [ 'ab', [ 'y' ] ] );
	} );

	it( 'outdents the first item of an inner list instead', () => {
		const t = tree( [ 'a', [ 'x', 'y' ] ] );
		mergeUp( t.s, t.a, t.make, 'x', len );
		expect( t.shape() ).toEqual( [ 'a', 'x', [ 'y' ] ] );
	} );

	it( 'leaves the first item of the outer list to the editor', () => {
		const t = tree( [ 'a', 'b' ] );
		expect( mergeUp( t.s, t.a, t.make, 'a', len ) ).toBe( false );
	} );
} );

describe( 'pasting lines', () => {
	it( 'makes one item a line, dropping the bullets and numbers the source wrote', () => {
		expect( pastedLines( '- Passport\n* Charger\n\n• Adapter' ) ).toEqual( [ 'Passport', 'Charger', 'Adapter' ] );
		expect( pastedLines( '1. One\r\n2) Two\na. Three' ) ).toEqual( [ 'One', 'Two', 'Three' ] );
	} );

	it( 'leaves a single line to the editor', () => {
		expect( pastedLines( 'Just one\n\n' ) ).toEqual( [] );
	} );

	it( 'keeps a number that is part of the words', () => {
		expect( pastedLines( '2026 plans\n3 days in Lisbon' ) ).toEqual( [ '2026 plans', '3 days in Lisbon' ] );
	} );
} );
