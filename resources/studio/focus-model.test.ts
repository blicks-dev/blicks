import { describe, expect, it } from 'vitest';
import { crumbsOf, dimCss, findBlock, isInScope, pathOf } from './focus-model';
import type { BlockNode } from './mount';

/*
 * The three shapes a focus scope has to serve before it is general: a mega panel deep inside a
 * header, a dialog inside a page section, and a Loop's card. If one of them needed a special case,
 * the scope would be shaped by headers.
 */
const b = ( clientId: string, name: string, innerBlocks: BlockNode[] = [] ): BlockNode => ( { clientId, name, innerBlocks } );

const header = [
	b( 'header', 'blicks/header', [
		b( 'row', 'blicks/header-row', [
			b( 'menu', 'blicks/nav', [
				b( 'products', 'blicks/nav-item', [
					b( 'panel', 'blicks/mega-panel', [ b( 'grid', 'blicks/box', [ b( 'link', 'blicks/menu-link' ) ] ) ] ),
				] ),
			] ),
		] ),
	] ),
];
const page = [ b( 'section', 'blicks/section', [ b( 'heading', 'blicks/heading' ), b( 'dialog', 'blicks/dialog', [ b( 'title', 'blicks/heading' ) ] ) ] ) ];
const shop = [ b( 'loop', 'blicks/loop', [ b( 'card', 'blicks/box', [ b( 'image', 'blicks/image' ) ] ) ] ) ];

const name = ( node: BlockNode ): string => node.name.replace( 'blicks/', '' );

describe( 'finding blocks', () => {
	it( 'finds a block and its path at any depth', () => {
		expect( findBlock( header, 'link' )?.name ).toBe( 'blicks/menu-link' );
		expect( pathOf( header, 'panel' ).map( ( n ) => n.clientId ) ).toEqual( [ 'header', 'row', 'menu', 'products', 'panel' ] );
		expect( findBlock( header, 'nope' ) ).toBeNull();
		expect( pathOf( header, 'nope' ) ).toEqual( [] );
	} );

	it( 'knows what is inside a scope, the scope included', () => {
		expect( isInScope( header, 'panel', 'link' ) ).toBe( true );
		expect( isInScope( header, 'panel', 'panel' ) ).toBe( true );
		expect( isInScope( header, 'panel', 'menu' ) ).toBe( false );
		expect( isInScope( page, 'dialog', 'heading' ) ).toBe( false );
		expect( isInScope( shop, 'card', 'image' ) ).toBe( true );
	} );
} );

describe( 'the breadcrumb', () => {
	it( 'walks down to a mega panel, names the scope its own way, then walks inside', () => {
		const crumbs = crumbsOf( header, { clientId: 'panel', label: 'Products panel' }, 'link', name );

		expect( crumbs.map( ( c ) => `${ c.where }:${ c.label }` ) ).toEqual( [
			'outside:header', 'outside:header-row', 'outside:nav', 'outside:nav-item', 'scope:Products panel', 'inside:box', 'inside:menu-link',
		] );
	} );

	it( 'ends at the scope when the scope itself, or nothing, is selected', () => {
		expect( crumbsOf( page, { clientId: 'dialog', label: 'Size guide' }, 'dialog', name ).map( ( c ) => c.where ) ).toEqual( [ 'outside', 'scope' ] );
		expect( crumbsOf( shop, { clientId: 'card', label: 'Card' }, null, name ).map( ( c ) => c.label ) ).toEqual( [ 'loop', 'Card' ] );
	} );

	it( 'ignores a selection outside the scope, and says nothing for a scope that is gone', () => {
		expect( crumbsOf( page, { clientId: 'dialog', label: 'Size guide' }, 'heading', name ) ).toHaveLength( 2 );
		expect( crumbsOf( page, { clientId: 'gone', label: 'x' }, null, name ) ).toEqual( [] );
	} );
} );

describe( 'dimming', () => {
	const css = dimCss( 'panel', '.bl-studio__viewport' );

	it( 'dims disabled blocks that do not hold the scope, never one inside another', () => {
		expect( css ).toContain( '.bl-studio__viewport .is-editing-disabled:not(:has([data-block="panel"])):not(.is-editing-disabled:not(:has([data-block="panel"])) *)' );
		expect( css ).toContain( 'opacity:.4' );
	} );

	it( 'cannot be broken out of by a client id', () => {
		expect( dimCss( 'a"]{}x', '.v' ) ).not.toContain( '"]{}' );
	} );
} );
