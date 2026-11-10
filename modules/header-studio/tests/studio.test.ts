/**
 * @vitest-environment jsdom
 *
 * The header mode's pure parts: converting a theme's header, the Layers tree, the starters, which
 * widths draw the drawer, and new headers' slugs.
 */
import '@blicks/test-runtime';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createBlocksFromInnerBlocksTemplate, registerBlockType, serialize } from '@wordpress/blocks';
import { blicks } from '../resources/blicks';
import { registerBlocks } from '../resources/blocks';
import { convertHeader, menuItems, menuRefs, type Parsed } from '../resources/studio/convert';
import { headerTree, isHeader, rowLabel } from '../resources/studio/tree';
import { DESIGNS, headerTemplate, LAYOUTS, megaPanel, panelInner, siteFrom, starterTemplate, topBarTemplate, type Template } from '../resources/studio/presets';
import { drawerAt } from '../resources/studio/canvas';
import { freeSlug, slugify } from '../resources/studio/new-header';
import { editLink, partId } from '../resources/studio/host';
import { usedLine } from '../resources/admin';
import { areaFor, TILES } from '../resources/studio/add';
import { AREA_BLOCKS } from '../resources/blocks/header-area';

registerBlocks( blicks()! );
// Core's own, which the test runtime does not load: a dynamic block saves nothing.
registerBlockType( 'core/site-title', { title: 'Site Title', category: 'theme', attributes: { level: { type: 'number' } }, save: () => null } as never );
registerBlockType( 'core/search', { title: 'Search', category: 'widgets', attributes: { label: { type: 'string' }, showLabel: { type: 'boolean' }, buttonPosition: { type: 'string' }, buttonUseIcon: { type: 'boolean' }, width: { type: 'number' }, widthUnit: { type: 'string' } }, save: () => null } as never );

const make = ( t: Template ) => createBlocksFromInnerBlocksTemplate( [ t as never ] ) as any[];

/** Twenty Twenty-Five's header, as its pattern parses. */
const THEME: Parsed[] = [
	{
		name: 'core/group',
		innerBlocks: [
			{
				name: 'core/group',
				innerBlocks: [
					{ name: 'core/site-title', attributes: { level: 0 } },
					{ name: 'core/group', innerBlocks: [ { name: 'core/navigation', attributes: { overlayBackgroundColor: 'base' } } ] },
					{ name: 'core/search', attributes: {} },
				],
			},
		],
	},
];

describe( 'converting a theme header', () => {
	it( 'keeps the title, makes the fallback menu menu items, and names what it dropped', () => {
		const fallback: Parsed[] = [
			{ name: 'core/navigation-link', attributes: { label: 'About', url: '/about' } },
			{ name: 'core/navigation-submenu', attributes: { label: 'Shop' }, innerBlocks: [ { name: 'core/navigation-link', attributes: { label: 'Bags', url: '/bags' } } ] },
		];
		const { template, dropped } = convertHeader( THEME, { 0: fallback } );
		const [ header ] = make( template );

		expect( dropped ).toEqual( [ 'core/search' ] );
		expect( header.name ).toBe( 'blicks/header' );
		const [ start, centre ] = header.innerBlocks[ 0 ].innerBlocks;
		expect( start.innerBlocks[ 0 ].name ).toBe( 'core/site-title' );
		const items = centre.innerBlocks[ 0 ].innerBlocks;
		expect( items.map( ( i: any ) => i.attributes.label ) ).toEqual( [ 'About', 'Shop' ] );
		expect( items[ 1 ].attributes.hasPanel ).toBe( true );
		expect( items[ 1 ].innerBlocks[ 0 ].name ).toBe( 'blicks/mega-panel' );
		// The result is valid saved markup.
		expect( serialize( [ header ] ) ).toContain( '<header class="bl-header' );
	} );

	it( 'reads a named Navigation menu over the fallback', () => {
		const blocks: Parsed[] = [ { name: 'core/navigation', attributes: { ref: 7 } } ];
		expect( menuRefs( blocks ) ).toEqual( [ 7 ] );
		const { template } = convertHeader( blocks, { 7: [ { name: 'core/navigation-link', attributes: { label: 'Mine', url: '/' } } ], 0: [] } );
		expect( JSON.stringify( template ) ).toContain( 'Mine' );
	} );

	it( 'turns a home link and leaves out a page list', () => {
		expect( menuItems( [ { name: 'core/home-link' }, { name: 'core/page-list' } ] ) ).toEqual( [ [ 'blicks/nav-item', { label: 'Home', url: '/' } ] ] );
	} );
} );

describe( 'the Layers tree', () => {
	it( 'names rows, areas, the menu and mega menus', () => {
		const site = { pages: [ { id: 1, title: 'Products', url: '/p/' } ] };
		const [ header ] = make( headerTemplate( 'classic', site ) );
		const nav = header.innerBlocks[ 0 ].innerBlocks[ 1 ].innerBlocks[ 0 ];
		nav.innerBlocks[ 0 ].innerBlocks = make( megaPanel( 'list', [ 1 ] ) );
		const withTop = { ...header, innerBlocks: [ ...make( topBarTemplate() ), ...header.innerBlocks ] };
		const [ root ] = headerTree( [ withTop ] );

		expect( root.label ).toBe( 'Header' );
		expect( root.note ).toBe( '2 rows' );
		expect( root.children!.map( ( r ) => r.label ) ).toEqual( [ 'Top bar', 'Main row' ] );
		const main = root.children![ 1 ];
		expect( main.children!.map( ( a ) => a.label ) ).toEqual( [ 'Start', 'Center', 'End' ] );
		const menu = main.children![ 1 ].children![ 0 ];
		expect( menu.label ).toBe( 'Menu' );
		expect( menu.children![ 0 ] ).toMatchObject( { label: 'Products', note: 'Mega' } );
	} );

	it( 'is the mode only for one Header block', () => {
		expect( isHeader( make( headerTemplate( 'stacked' ) ) ) ).toBe( true );
		expect( isHeader( [ { name: 'blicks/box' } ] ) ).toBe( false );
		expect( rowLabel( { name: 'blicks/header-row' }, 2, 3 ) ).toBe( 'Row 3' );
	} );
} );

describe( 'starters', () => {
	const site = siteFrom( [
		{ id: 2, title: { rendered: 'About' }, link: '/about/', slug: 'about', parent: 0 },
		{ id: 3, title: { rendered: 'Contact us' }, link: '/contact/', slug: 'contact', parent: 0 },
		{ id: 4, title: { rendered: 'Team' }, link: '/about/team/', slug: 'team', parent: 2 },
		{ id: 5, title: { rendered: 'Shop' }, link: '/shop/', slug: 'shop', parent: 0 },
	] );

	it( 'reads the site: top pages for the menu, the contact page for the button', () => {
		expect( site.pages.map( ( p ) => p.title ) ).toEqual( [ 'About', 'Shop' ] );
		expect( site.cta ).toEqual( { label: 'Contact us', url: '/contact/' } );
	} );

	it( 'builds each layout from the site, the button a large link', () => {
		for ( const layout of [ 'classic', 'centred', 'stacked' ] as const ) {
			const [ header ] = make( headerTemplate( layout, site ) );
			expect( header.innerBlocks[ 0 ].attributes.preset ).toBe( layout );
			const markup = serialize( [ header ] );
			expect( markup ).toContain( 'href="/about/"' );
			expect( markup ).toMatch( /<a class="bl-button[^"]*bl-button--lg[^"]*" href="\/contact\/"/ );
		}
	} );

	it( 'never writes made-up text: no brackets and no "#" links in any starter', () => {
		const all = [ ...[ 'classic', 'centred', 'stacked' ].map( ( l ) => headerTemplate( l as never ) ), topBarTemplate(), ...[ 'columns', 'list' ].map( ( l ) => megaPanel( l as never, [ 2, 5, 7, 9 ] ) ) ];
		for ( const t of all ) {
			// What prints: the markup without the block comments, whose JSON holds arrays.
			const markup = serialize( make( t ) ).replace( /<!--[\s\S]*?-->/g, '' );
			expect( markup ).not.toMatch( /\[[^\]"]+\]/ );
			expect( markup ).not.toContain( 'href="#"' );
		}
	} );

	it( 'splits the pages into up to three Link list columns', () => {
		const [ grid ] = panelInner( 'columns', [ 1, 2, 3, 4, 5, 6, 7 ] );
		expect( grid[ 0 ] ).toBe( 'blicks/box' );
		expect( ( grid[ 1 ] as any ).blicks[ 'layout.display' ].default.base ).toBe( 'grid' );
		expect( ( grid[ 2 ] ?? [] ).length ).toBe( 3 );
		expect( panelInner( 'list', [ 1, 2 ] )[ 0 ][ 0 ] ).toBe( 'blicks/box' );
	} );
} );

describe( 'header patterns', () => {
	// The Site Editor's header patterns (src/Patterns.php) are these starters as saved markup. Like a
	// golden, a diff is deliberate: re-run with -u once the change is meant.
	it.each( [ ...LAYOUTS, ...DESIGNS ].map( ( s ) => s.id ) )( '%s matches its pattern file', async ( starter ) => {
		await expect( serialize( make( starterTemplate( starter ) ) ) + '\n' ).toMatchFileSnapshot( resolve( __dirname, `../patterns/${ starter }.html` ) );
	} );

	it( 'registers a pattern for every starter, and no other', () => {
		const php = readFileSync( resolve( __dirname, '../src/Patterns.php' ), 'utf8' );
		const listed = /LAYOUTS = \[([^\]]*)\]/.exec( php )?.[ 1 ].match( /'([a-z-]+)'/g )?.map( ( q ) => q.slice( 1, -1 ) );
		expect( listed ).toEqual( [ ...LAYOUTS, ...DESIGNS ].map( ( s ) => s.id ) );
	} );

	it( 'styles the designed starters with design tokens, not fixed colours', () => {
		for ( const d of DESIGNS ) expect( JSON.stringify( starterTemplate( d.id ) ) ).not.toMatch( /#[0-9a-f]{3,8}\b/i );
	} );
} );

describe( 'helpers', () => {
	it( 'draws the drawer at the widths the header asks for', () => {
		expect( [ 'desktop', 'tablet', 'phone' ].map( ( w ) => drawerAt( 'tablet', w as never ) ) ).toEqual( [ false, true, true ] );
		expect( [ 'desktop', 'tablet', 'phone' ].map( ( w ) => drawerAt( 'mobile', w as never ) ) ).toEqual( [ false, false, true ] );
		expect( drawerAt( 'always', 'desktop' ) ).toBe( true );
		expect( drawerAt( 'never', 'phone' ) ).toBe( false );
	} );

	it( 'makes a free slug', () => {
		expect( slugify( 'Main Header!' ) ).toBe( 'main-header' );
		expect( slugify( '' ) ).toBe( 'header' );
		expect( freeSlug( 'main-header', [ 'main-header', 'main-header-2' ] ) ).toBe( 'main-header-3' );
	} );

	it( 'reads and writes a template part ref', () => {
		expect( partId( { kind: 'template-part', id: 'twentytwentyfive//header' } ) ).toBe( 'twentytwentyfive//header' );
		expect( partId( { kind: 'post', id: 3 } ) ).toBe( '' );
		expect( editLink( 'tt//header' ) ).toContain( 'blicks-studio=ref%3Aheader%3A' );
	} );

	it( 'says where a header is used', () => {
		expect( usedLine( [] ) ).toBe( 'Not used by any template' );
		expect( usedLine( [ 1, 2, 3, 4 ].map( ( n ) => ( { id: `t${ n }`, title: `T${ n }`, kind: 'template' } ) ) ) ).toBe( 'Used on 4 templates: T1, T2, T3 +1' );
	} );
} );

describe( 'adding to a row', () => {
	const [ header ] = make( headerTemplate( 'classic' ) );
	const areas = header.innerBlocks[ 0 ].innerBlocks;
	const slotOf = ( a: any ) => a?.attributes.slot;
	const tile = ( id: string ) => TILES.find( ( t ) => t.id === id )!;

	it( 'puts each element where a header usually has it, unless an area is picked', () => {
		expect( slotOf( areaFor( areas, '', tile( 'logo' ) ) ) ).toBe( 'start' );
		expect( slotOf( areaFor( areas, '', tile( 'menu' ) ) ) ).toBe( 'centre' );
		expect( slotOf( areaFor( areas, '', tile( 'button' ) ) ) ).toBe( 'end' );
		expect( slotOf( areaFor( areas, 'centre', tile( 'logo' ) ) ) ).toBe( 'centre' );
	} );

	it( 'offers only what a header area may hold', () => {
		for ( const t of TILES ) {
			expect( AREA_BLOCKS ).toContain( t.template()[ 0 ] );
		}
	} );
} );
