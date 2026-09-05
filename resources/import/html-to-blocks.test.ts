import { describe, expect, it } from 'vitest';
import { cssToBlicks, pickBlock } from './html-to-blocks';
import { parseDeclarations } from './css-coverage';

describe( 'html-to-blocks: cssToBlicks', () => {
	it( 'auto-maps safe single controls to blicks attrs', () => {
		const out = cssToBlicks( parseDeclarations( 'display: flex; color: #fff; font-weight: 700' ) );
		expect( out.blicks[ 'layout.display' ] ).toEqual( { default: { base: 'flex' } } );
		expect( out.blicks[ 'colors.text' ] ).toEqual( { default: { base: '#fff' } } );
		expect( out.blicks[ 'typography.fontWeight' ] ).toEqual( { default: { base: '700' } } );
		expect( out.autoMapped ).toBe( 3 );
		expect( out.fallback ).toEqual( [] );
	} );

	it( 'reports structured controls (padding) + uncovered props as unmapped, not blicks attrs', () => {
		const out = cssToBlicks( parseDeclarations( 'padding: 8px 16px; caret-color: red' ) );
		expect( out.blicks[ 'spacing.padding' ] ).toBeUndefined(); // structured → custom in v1
		expect( out.controlled ).toBe( 1 ); // padding has a control…
		expect( out.custom ).toBe( 1 ); // …caret-color doesn't
		expect( out.autoMapped ).toBe( 0 );
		expect( out.fallback ).toEqual( [ 'padding', 'caret-color' ] );
	} );
} );

describe( 'html-to-blocks: pickBlock', () => {
	it( 'maps semantic tags to blocks', () => {
		expect( pickBlock( 'H2', [] ) ).toEqual( { name: 'blicks/heading', extra: { level: 2 } } );
		expect( pickBlock( 'p', [] ).name ).toBe( 'blicks/text' );
		expect( pickBlock( 'ul', [] ) ).toEqual( { name: 'blicks/list', extra: { marker: 'disc' } } );
		expect( pickBlock( 'ol', [] ).extra ).toEqual( { marker: 'decimal' } );
		expect( pickBlock( 'img', [] ).name ).toBe( 'blicks/image' );
		expect( pickBlock( 'button', [] ).name ).toBe( 'blicks/button' );
	} );

	it( 'maps a div by its display: flex → Stack, grid → Grid, else Box', () => {
		expect( pickBlock( 'div', parseDeclarations( 'display: flex' ) ).name ).toBe( 'blicks/stack' );
		expect( pickBlock( 'div', parseDeclarations( 'display: grid' ) ).name ).toBe( 'blicks/grid' );
		expect( pickBlock( 'div', [] ).name ).toBe( 'blicks/box' );
	} );
} );
