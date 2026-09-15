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
		expect( pickBlock( 'ul', [] ) ).toEqual( { name: 'core/list', extra: { ordered: false } } );
		expect( pickBlock( 'ol', [] ) ).toEqual( { name: 'core/list', extra: { ordered: true } } );
		expect( pickBlock( 'li', [] ).name ).toBe( 'core/list-item' );
		expect( pickBlock( 'img', [] ).name ).toBe( 'blicks/image' );
		expect( pickBlock( 'button', [] ).name ).toBe( 'blicks/button' );
	} );

	/**
	 * `ul`/`ol`/`li` used to map to `blicks/list` and `blicks/list-item`, which this plugin does
	 * not register. `createBlock()` throws for an unregistered name, and the importer builds its
	 * preview during render, so pasting a list took the whole editor down with
	 * "The editor has encountered an unexpected error."
	 */
	it( 'never names a Blicks block that is not shipped', () => {
		const shipped = new Set( [
			'blicks/box', 'blicks/button', 'blicks/buttons', 'blicks/divider', 'blicks/grid',
			'blicks/heading', 'blicks/icon', 'blicks/image', 'blicks/section', 'blicks/spacer',
			'blicks/stack', 'blicks/text',
		] );
		const tags = [
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'img', 'hr', 'button',
			'div', 'section', 'span', 'article', 'main', 'figure', 'blockquote', 'table',
		];

		for ( const tag of tags ) {
			const { name } = pickBlock( tag, [] );
			if ( name.startsWith( 'blicks/' ) ) {
				expect( shipped.has( name ) ).toBe( true );
			} else {
				// Anything else must be a core block, which is always registered.
				expect( name.startsWith( 'core/' ) ).toBe( true );
			}
		}
	} );

	it( 'maps a div by its display: flex → Stack, grid → Grid, else Box', () => {
		expect( pickBlock( 'div', parseDeclarations( 'display: flex' ) ).name ).toBe( 'blicks/stack' );
		expect( pickBlock( 'div', parseDeclarations( 'display: grid' ) ).name ).toBe( 'blicks/grid' );
		expect( pickBlock( 'div', [] ).name ).toBe( 'blicks/box' );
	} );
} );
