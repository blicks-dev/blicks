/**
 * Starting headers and mega menu layouts, as block templates (`[ name, attributes, inner ]`), so
 * they become real blocks through `createBlocksFromInnerBlocksTemplate`.
 *
 * **Nothing here prints made-up text on a page.** A starter is built from the site: its title (the
 * Site Title block), its pages as the menu and as Link lists, its contact page as the call to
 * action. What the site cannot supply is left empty, so the editor shows the block's placeholder
 * and the page prints nothing for it (BlicksPro\HeaderStudio\Render::withoutEmpty()).
 */
import { __ } from '@wordpress/i18n';

export type Template = [ string, Record< string, unknown >?, Template[]? ];

export type Layout = 'classic' | 'centred' | 'stacked';

/** What a starter can use from the site. */
export interface Site {
	pages: { id: number; title: string; url: string }[];
	/** The call to action: a contact page, if the site has one. */
	cta?: { label: string; url: string };
}

const EMPTY: Site = { pages: [] };

const logo = (): Template => [ 'core/site-title', { level: 0 } ];

/** The menu: the site's top pages, or one empty item to type into. */
const menu = ( site: Site ): Template => [
	'blicks/nav',
	{},
	site.pages.length
		? site.pages.slice( 0, 5 ).map( ( p ): Template => [ 'blicks/nav-item', { label: p.title, url: p.url } ] )
		: [ [ 'blicks/nav-item', {} ] ],
];

/** The call to action: a large link button to the contact page, else an empty one to fill in. */
const actions = ( site: Site ): Template => [
	'blicks/buttons',
	{},
	[ [ 'blicks/button', { text: site.cta?.label ?? '', url: site.cta?.url ?? '', size: 'lg' } ] ],
];

const area = ( slot: string, inner: Template[] = [] ): Template => [ 'blicks/header-area', { slot }, inner ];

/** A header of one row, laid out as the preset says. */
export function headerTemplate( layout: Layout, site: Site = EMPTY ): Template {
	const row: Template =
		layout === 'centred'
			? [ 'blicks/header-row', { preset: 'centred' }, [ area( 'start', [ menu( site ) ] ), area( 'centre', [ logo() ] ), area( 'end', [ actions( site ) ] ) ] ]
			: [ 'blicks/header-row', { preset: layout }, [ area( 'start', [ logo() ] ), area( 'centre', [ menu( site ) ] ), area( 'end', [ actions( site ) ] ) ] ];

	return [ 'blicks/header', { sticky: true }, [ row ] ];
}

/** The row a "top bar" adds above the main one: a line of text to write, empty until written. */
export function topBarTemplate(): Template {
	return [ 'blicks/header-row', { preset: 'classic', metadata: { name: __( 'Top bar', 'blicks-pro' ) } }, [ area( 'start', [ [ 'blicks/text', { tag: 'span' } ] ] ), area( 'centre' ), area( 'end' ) ] ];
}

export const LAYOUTS: { id: Layout; label: string; description: string }[] = [
	{ id: 'classic', label: __( 'Classic', 'blicks-pro' ), description: __( 'Site title, menu, then a button on the right.', 'blicks-pro' ) },
	{ id: 'centred', label: __( 'Centered', 'blicks-pro' ), description: __( 'The site title in the middle, the menu and the button either side.', 'blicks-pro' ) },
	{ id: 'stacked', label: __( 'Stacked', 'blicks-pro' ), description: __( 'The site title above the menu, all centered.', 'blicks-pro' ) },
];

/*
 * Designed starters: the marketplace's header designs, rebuilt from the header blocks. Each one is
 * styled with design tokens only (colours, spacing, radius), so it takes on the site's palette, and
 * fills its words from the site like the layouts above. What the blocks cannot do yet is left out
 * rather than faked: an announcement that remembers being closed, a language select, recent searches.
 */

export type Design = 'minimal-centred' | 'classic-split' | 'announcement-bar' | 'sticky-shrink' | 'hide-on-scroll' | 'search-first' | 'simple-dropdown' | 'two-tier-utility' | 'mega-menu-columns';

/** Any starting header: a layout or a design. */
export type Starter = Layout | Design;

type Styles = Record< string, unknown >;

/** A `blicks` style attribute from plain values (the default state, every width) and optional hover values. */
const style = ( base: Styles, hover: Styles = {} ): { blicks: Record< string, Record< string, { base: unknown } > > } => {
	const out: Record< string, Record< string, { base: unknown } > > = {};
	for ( const [ id, v ] of Object.entries( base ) ) out[ id ] = { default: { base: v } };
	for ( const [ id, v ] of Object.entries( hover ) ) out[ id ] = { ...( out[ id ] ?? {} ), hover: { base: v } };
	return { blicks: out };
};

const sides = ( top: string, right = top, bottom = top, left = right ) => ( { top, right, bottom, left } );
const corners = ( r: string ) => ( { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r } );

/** A one-pixel line under a row, in the palette's border colour. */
const LINE_BELOW: Styles = {
	'border.width': sides( '0', '0', '1px', '0' ),
	'border.style': sides( 'solid' ),
	'border.color': sides( 'var(--blicks-color-border)' ),
};

/**
 * A row's look: its height, colours and type, plus a line under it unless `line` is false. A row
 * over the hero has no `surface`: the header turns it clear there and solid once scrolled.
 */
const rowStyle = ( minHeight: string, extra: Styles = {}, line = true, surface = true ): Styles =>
	style( { 'layout.minHeight': minHeight, ...( surface ? { 'colors.background': 'background' } : {} ), ...( line ? LINE_BELOW : {} ), ...extra } );

/** Menu links: quiet until hovered, then the full ink colour (and a fill, for pill links). */
const quietLinks = ( padding: ReturnType< typeof sides >, pill?: string ): Styles =>
	style(
		{ 'colors.text': 'muted-foreground', 'spacing.padding': padding, ...( pill ? { 'border.radius': corners( pill ) } : {} ) },
		{ 'colors.text': 'foreground', ...( pill ? { 'colors.background': 'muted' } : {} ) }
	);

/**
 * The menu as a design styles it: the site's top pages (up to `count`), each link styled alike. The
 * first `panels` items open a mega menu of the site's pages, made by `panel`.
 */
const styledMenu = ( site: Site, links: Styles, gap: string, count = 5, panels = 0, panel?: ( pages: number[] ) => Template ): Template => {
	const pages = site.pages.slice( 0, count );
	const ids = site.pages.map( ( p ) => p.id );
	const items = ( pages.length ? pages : [ { title: '', url: '' } ] ).map(
		( p, i ): Template => [ 'blicks/nav-item', { label: p.title, url: p.url, ...links }, panel && i < panels ? [ panel( ids ) ] : [] ]
	);
	return [ 'blicks/nav', style( { 'layout.gapColumn': gap } ), items ];
};

/** The call to action, and before it an optional quieter button: both empty until the site fills them. */
const styledActions = ( site: Site, quiet?: 'ghost' | 'outline' ): Template => [
	'blicks/buttons',
	{},
	[ ...( quiet ? [ [ 'blicks/button', { text: '', url: '', variant: quiet } ] as Template ] : [] ), [ 'blicks/button', { text: site.cta?.label ?? '', url: site.cta?.url ?? '' } ] ],
];

/** A thin row above the main one, in the palette's ink with its paper colour for text: one line to write. */
const noticeRow = ( name: string, slot: 'start' | 'centre' ): Template => [
	'blicks/header-row',
	{ preset: 'classic', metadata: { name }, ...rowStyle( '40px', { 'colors.background': 'foreground', 'colors.text': 'background', 'typography.fontSize': 'sm' }, false ) },
	[ area( 'start', 'start' === slot ? [ [ 'blicks/text', { tag: 'span' } ] ] : [] ), area( 'centre', 'centre' === slot ? [ [ 'blicks/text', { tag: 'span' } ] ] : [] ), area( 'end' ) ],
];

const dropdown = ( width: 'content' | 'full', layout: PanelLayout ) => ( pages: number[] ): Template => [ 'blicks/mega-panel', { width, animation: 'slide' }, panelInner( layout, pages ) ];

/** A designed starting header, built from the site. */
export function designTemplate( design: Design, site: Site = EMPTY ): Template {
	const pill = quietLinks( sides( '10px', '14px' ), 'full' );

	switch ( design ) {
		case 'minimal-centred':
			return [
				'blicks/header',
				{ drawerAt: 'mobile' },
				[
					[
						'blicks/header-row',
						{ preset: 'stacked', ...rowStyle( '0', { 'spacing.padding': sides( 'xl', '0', 'md', '0' ) } ) },
						[
							area( 'start', [ [ 'core/site-title', { level: 0, style: { typography: { fontSize: '2rem', fontWeight: '600', letterSpacing: '-0.02em' } } } ] ] ),
							area( 'centre', [ styledMenu( site, quietLinks( sides( 'xs', '2px' ) ), 'lg' ) ] ),
							area( 'end' ),
						],
					],
				],
			];

		case 'classic-split':
			return [
				'blicks/header',
				{ sticky: true },
				[ [ 'blicks/header-row', { preset: 'classic', ...rowStyle( '68px', { 'layout.gapColumn': 'lg' } ) }, [ area( 'start', [ logo() ] ), area( 'centre', [ styledMenu( site, pill, 'xs' ) ] ), area( 'end', [ styledActions( site, 'ghost' ) ] ) ] ] ],
			];

		case 'announcement-bar':
			return [
				'blicks/header',
				{},
				[
					noticeRow( __( 'Announcement', 'blicks-pro' ), 'centre' ),
					[ 'blicks/header-row', { preset: 'classic', ...rowStyle( '64px' ) }, [ area( 'start', [ logo(), styledMenu( site, quietLinks( sides( 'sm', '0' ) ), 'lg' ) ] ), area( 'centre' ), area( 'end', [ styledActions( site ) ] ) ] ],
				],
			];

		case 'sticky-shrink':
			// Over the hero it is clear with the hero's colours; scrolled, the header's own surface shows.
			return [
				'blicks/header',
				{ sticky: true, shrink: true, overHero: true },
				[
					[
						'blicks/header-row',
						{ preset: 'classic', ...rowStyle( '88px', {}, false, false ) },
						[ area( 'start', [ logo() ] ), area( 'centre' ), area( 'end', [ styledMenu( site, style( { 'spacing.padding': sides( '10px', '14px' ), 'border.radius': corners( 'full' ) }, { 'colors.background': 'rgb(127 127 127 / .16)' } ), 'xs' ), styledActions( site ) ] ) ],
					],
				],
			];

		case 'hide-on-scroll':
			// A reading header: slides away on the way down and back on the way up. Title, a quiet
			// menu beside it, the call to action as a link in the accent colour.
			return [
				'blicks/header',
				{ sticky: true, hideOnScroll: true },
				[
					[
						'blicks/header-row',
						{ preset: 'classic', ...rowStyle( '60px', { 'layout.gapColumn': 'lg' } ) },
						[
							area( 'start', [ logo(), styledMenu( site, quietLinks( sides( 'xs', '0' ) ), 'md', 4 ) ] ),
							area( 'centre' ),
							area( 'end', [ [ 'blicks/buttons', {}, [ [ 'blicks/button', { text: site.cta?.label ?? '', url: site.cta?.url ?? '', variant: 'link' } ] ] ] ] ),
						],
					],
				],
			];

		case 'search-first':
			return [
				'blicks/header',
				{},
				[
					[
						'blicks/header-row',
						{ preset: 'classic', ...rowStyle( '72px', { 'layout.gapColumn': 'lg' }, false ) },
						[
							area( 'start', [ logo() ] ),
							area( 'centre', [ [ 'core/search', { label: __( 'Search', 'blicks-pro' ), showLabel: false, buttonPosition: 'button-inside', buttonUseIcon: true, width: 100, widthUnit: '%' } ] ] ),
							area( 'end', [ styledActions( site ) ] ),
						],
					],
					[ 'blicks/header-row', { preset: 'classic', metadata: { name: __( 'Categories', 'blicks-pro' ) }, ...rowStyle( '44px', { 'typography.fontSize': 'sm' } ) }, [ area( 'start', [ styledMenu( site, quietLinks( sides( 'xs', '0' ) ), 'lg', 7 ) ] ), area( 'centre' ), area( 'end' ) ] ],
				],
			];

		case 'simple-dropdown':
			return [
				'blicks/header',
				{},
				[ [ 'blicks/header-row', { preset: 'classic', ...rowStyle( '66px' ) }, [ area( 'start', [ logo(), styledMenu( site, quietLinks( sides( '10px', '12px' ), 'md' ), 'xs', 5, 2, dropdown( 'content', 'list' ) ) ] ), area( 'centre' ), area( 'end', [ styledActions( site ) ] ) ] ] ],
			];

		case 'two-tier-utility':
			return [
				'blicks/header',
				{},
				[
					noticeRow( __( 'Utility bar', 'blicks-pro' ), 'start' ),
					[ 'blicks/header-row', { preset: 'classic', ...rowStyle( '68px' ) }, [ area( 'start', [ logo(), styledMenu( site, quietLinks( sides( '10px', '12px' ), 'sm' ), 'xs' ) ] ), area( 'centre' ), area( 'end', [ styledActions( site ) ] ) ] ],
				],
			];

		case 'mega-menu-columns':
			return [
				'blicks/header',
				{},
				[ [ 'blicks/header-row', { preset: 'classic', ...rowStyle( '64px' ) }, [ area( 'start', [ logo(), styledMenu( site, pill, 'xs', 5, 1, dropdown( 'full', 'columns' ) ) ] ), area( 'centre' ), area( 'end', [ styledActions( site ) ] ) ] ] ],
			];
	}
}

/** Any starter, as a block template. */
export function starterTemplate( starter: Starter, site: Site = EMPTY ): Template {
	return ( LAYOUTS as { id: string }[] ).some( ( l ) => l.id === starter ) ? headerTemplate( starter as Layout, site ) : designTemplate( starter as Design, site );
}

/** Which of the picker's three-bar thumbnails a starter draws: its layout, or two rows. */
export type Thumb = Layout | 'rows';

export const DESIGNS: { id: Design; label: string; description: string; thumb: Thumb }[] = [
	{ id: 'minimal-centred', thumb: 'stacked', label: __( 'Minimal centered', 'blicks-pro' ), description: __( 'A large site title over a quiet row of links. Editorial and calm.', 'blicks-pro' ) },
	{ id: 'classic-split', thumb: 'classic', label: __( 'Classic split', 'blicks-pro' ), description: __( 'Title left, pill links centered, a quiet and a main button right. Stays on top.', 'blicks-pro' ) },
	{ id: 'announcement-bar', thumb: 'rows', label: __( 'Announcement bar', 'blicks-pro' ), description: __( 'A dark strip for a line of news above a plain header.', 'blicks-pro' ) },
	{ id: 'sticky-shrink', thumb: 'classic', label: __( 'Over the hero', 'blicks-pro' ), description: __( 'Clear over the first section, then a compact solid bar once you scroll.', 'blicks-pro' ) },
	{ id: 'hide-on-scroll', thumb: 'classic', label: __( 'Hide on scroll', 'blicks-pro' ), description: __( 'Slides out of the way as you read down, and back the moment you scroll up.', 'blicks-pro' ) },
	{ id: 'search-first', thumb: 'rows', label: __( 'Search first', 'blicks-pro' ), description: __( 'A wide search between the title and the button, with a row of links below.', 'blicks-pro' ) },
	{ id: 'simple-dropdown', thumb: 'classic', label: __( 'Simple dropdown', 'blicks-pro' ), description: __( 'The first two links open a short list of your pages.', 'blicks-pro' ) },
	{ id: 'two-tier-utility', thumb: 'rows', label: __( 'Two tiers', 'blicks-pro' ), description: __( 'A thin utility bar above the title, menu and button.', 'blicks-pro' ) },
	{ id: 'mega-menu-columns', thumb: 'classic', label: __( 'Mega menu: columns', 'blicks-pro' ), description: __( 'The first link opens a full-width panel of your pages in columns.', 'blicks-pro' ) },
];

export type PanelLayout = 'columns' | 'list';

const base = ( value: string ) => ( { default: { base: value } } );

/**
 * A Box laid out one under another — what Blicks' Arrange ▸ Stack writes, in the plugin's own
 * value tree. Written out here because a module never imports Blicks code (modules/README.md).
 */
export const stackBox = ( gap = 'md' ): Record< string, unknown > => ( {
	blicks: {
		'layout.display': base( 'flex' ),
		'layout.flexDirection': base( 'column' ),
		'layout.alignItems': base( 'stretch' ),
		'layout.justifyContent': base( 'flex-start' ),
		'layout.flexWrap': base( 'nowrap' ),
		'layout.gapRow': base( gap ),
		'layout.gapColumn': base( gap ),
	},
} );

/** A Box of even columns — Arrange ▸ Grid, without the phone rule: a phone shows a mega menu as a drawer. */
export const gridBox = ( columns: number, gap = 'md' ): Record< string, unknown > => ( {
	blicks: {
		'layout.display': base( 'grid' ),
		'layout.gridColumns': base( `repeat(${ columns }, minmax(0, 1fr))` ),
		'layout.gapRow': base( gap ),
		'layout.gapColumn': base( gap ),
	},
} );

/** A column: a heading to write (empty until written) over a Link list of some of the site's pages. */
const column = ( pages: number[] ): Template => [ 'blicks/box', stackBox(), [ [ 'blicks/heading', { level: 3 } ], [ 'blicks/link-list', { source: 'pages', pages } ] ] ];

/** The blocks inside a mega menu, for a layout, from the site's pages. */
export function panelInner( layout: PanelLayout, pages: number[] = [] ): Template[] {
	if ( layout === 'list' || pages.length < 2 ) {
		return [ column( pages ) ];
	}

	const count = Math.min( 3, pages.length );
	const size = Math.ceil( pages.length / count );
	const columns = Array.from( { length: count }, ( _, i ) => pages.slice( i * size, ( i + 1 ) * size ) ).filter( ( c ) => c.length );

	return [ [ 'blicks/box', gridBox( columns.length ), columns.map( column ) ] ];
}

export function megaPanel( layout: PanelLayout, pages: number[] = [] ): Template {
	return [ 'blicks/mega-panel', {}, panelInner( layout, pages ) ];
}

export const PANEL_LAYOUTS: { id: PanelLayout; label: string }[] = [
	{ id: 'columns', label: __( 'Columns of your pages', 'blicks-pro' ) },
	{ id: 'list', label: __( 'One list of your pages', 'blicks-pro' ) },
];

type PageRecord = { id: number; title?: { rendered?: string }; link?: string; slug?: string; parent?: number };

/** The site's top-level published pages as starters use them, with a contact page as the CTA. */
export function siteFrom( records: PageRecord[] ): Site {
	const plain = ( html: unknown ) => String( html ?? '' ).replace( /<[^>]*>/g, '' ).trim();
	const pages = records
		.filter( ( r ) => ! r.parent && plain( r.title?.rendered ) && r.link )
		.map( ( r ) => ( { id: r.id, title: plain( r.title?.rendered ), url: String( r.link ), slug: String( r.slug ?? '' ) } ) );
	const contact = pages.find( ( p ) => /contact/.test( p.slug ) );

	return {
		pages: pages.filter( ( p ) => p !== contact ).map( ( { id, title, url } ) => ( { id, title, url } ) ),
		...( contact ? { cta: { label: contact.title, url: contact.url } } : {} ),
	};
}

export const PAGES_PATH = '/wp/v2/pages?per_page=20&status=publish&orderby=menu_order&order=asc&_fields=id,title,link,slug,parent';
