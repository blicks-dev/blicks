import { describe, expect, it } from 'vitest';
import { applyArrange, arrangeDefaults, readArrange, rearrange } from './model';

describe( 'rearrange', () => {
	it( 'picks an arrangement from nothing with its defaults', () => {
		const out = rearrange( {}, false, 'row' );
		expect( out ).toEqual( applyArrange( {}, 'row', arrangeDefaults( 'row', readArrange( {}, false ).options ) ) );
		expect( readArrange( out.tree, out.layers ).arrangement ).toBe( 'row' );
	} );

	it( 'keeps the current options when the same arrangement is picked with a patch', () => {
		const grid = rearrange( {}, false, 'grid', { cols: 4 } );
		const again = rearrange( grid.tree, grid.layers, 'grid' );
		expect( again.tree ).toEqual( grid.tree );
		expect( readArrange( again.tree, again.layers ).options.cols ).toBe( 4 );
	} );

	it( 'carries the gap across to another arrangement', () => {
		const stack = rearrange( {}, false, 'stack', { gap: '2xl' } );
		const row = rearrange( stack.tree, stack.layers, 'row' );
		expect( readArrange( row.tree, row.layers ).options.gap ).toBe( '2xl' );
	} );

	it( 'turns layers on for On top, and off again', () => {
		const top = rearrange( {}, false, 'layers' );
		expect( top.layers ).toBe( true );
		expect( rearrange( top.tree, top.layers, 'stack' ).layers ).toBe( false );
	} );
} );
