/**
 * A theme's own header, made a Header Studio header: what a header template part holds when it
 * was not built here (Twenty Twenty-Five's: a group with the site title and a Navigation block).
 *
 * Kept: the site logo and title, in the start area; the menu's links and submenus, as menu items
 * and mega menus of Menu links; buttons, at the end. Anything else is left out, and the caller says
 * so. Pure: the Navigation menu's own blocks are passed in, already read.
 */
import { headerTemplate, stackBox, type Template } from './presets';

export interface Parsed {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: Parsed[];
}

export interface Converted {
	template: Template;
	/** Block names that had no place in the header. */
	dropped: string[];
}

const KEEP_START = [ 'core/site-logo', 'core/site-title' ];

function walk( blocks: Parsed[], visit: ( b: Parsed ) => boolean ): void {
	for ( const b of blocks ) {
		if ( visit( b ) ) walk( b.innerBlocks ?? [], visit );
	}
}

/** Menu items from a Navigation menu's own blocks: links, and submenus as mega menus. */
export function menuItems( links: Parsed[] ): Template[] {
	return links.flatMap( ( link ): Template[] => {
		const a = link.attributes ?? {};
		const label = String( a.label ?? '' );
		const url = String( a.url ?? '' );

		if ( link.name === 'core/navigation-link' || link.name === 'core/home-link' ) {
			return [ [ 'blicks/nav-item', { label: label || 'Home', url: url || '/' } ] ];
		}

		if ( link.name === 'core/navigation-submenu' ) {
			const children = ( link.innerBlocks ?? [] ).filter( ( c ) => c.name === 'core/navigation-link' );
			return [
				[
					'blicks/nav-item',
					{ label, hasPanel: true },
					[
						[
							'blicks/mega-panel',
							{ width: 'content' },
							[ [ 'blicks/box', stackBox(), children.map( ( c ): Template => [ 'blicks/menu-link', { label: String( c.attributes?.label ?? '' ), url: String( c.attributes?.url ?? '' ) } ] ) ] ],
						],
					],
				],
			];
		}

		return [];
	} );
}

/**
 * @param blocks  The template part's blocks.
 * @param menus   A Navigation menu's blocks, by the `ref` its Navigation block names; `0` is the
 *                site's fallback, for a Navigation block that names none.
 */
export function convertHeader( blocks: Parsed[], menus: Record< number, Parsed[] > ): Converted {
	const start: Template[] = [];
	let items: Template[] = [];
	const end: Template[] = [];
	const dropped = new Set< string >();

	walk( blocks, ( b ) => {
		if ( KEEP_START.includes( b.name ) ) {
			start.push( [ b.name, { ...( b.attributes ?? {} ) } ] );
			return false;
		}
		if ( b.name === 'core/navigation' ) {
			const ref = Number( b.attributes?.ref );
			// A Navigation block with no menu of its own shows the site's fallback, passed in as `0`.
			const own = Number.isInteger( ref ) && menus[ ref ] ? menus[ ref ] : b.innerBlocks ?? [];
			const inner = own.length ? own : menus[ 0 ] ?? [];
			items = items.concat( menuItems( inner ) );
			return false;
		}
		if ( b.name === 'core/buttons' ) {
			for ( const btn of b.innerBlocks ?? [] ) {
				const text = String( btn.attributes?.text ?? '' ).replace( /<[^>]*>/g, '' );
				end.push( [ 'blicks/button', { text, url: String( btn.attributes?.url ?? '' ) } ] );
			}
			return false;
		}
		if ( ! [ 'core/group', 'core/columns', 'core/column', 'core/row', 'core/stack' ].includes( b.name ) ) {
			dropped.add( b.name );
			return false;
		}
		return true;
	} );

	const [ , headerAttrs, rows ] = headerTemplate( 'classic' );
	const [ , rowAttrs ] = ( rows ?? [] )[ 0 ];

	const template: Template = [
		'blicks/header',
		headerAttrs,
		[
			[
				'blicks/header-row',
				rowAttrs,
				[
					[ 'blicks/header-area', { slot: 'start' }, start ],
					[ 'blicks/header-area', { slot: 'centre' }, items.length ? [ [ 'blicks/nav', {}, items ] ] : [] ],
					[ 'blicks/header-area', { slot: 'end' }, end.length ? [ [ 'blicks/buttons', {}, end ] ] : [] ],
				],
			],
		],
	];

	return { template, dropped: [ ...dropped ].filter( ( n ) => !! n ) };
}

/** The Navigation menu ids a tree's Navigation blocks name. */
export function menuRefs( blocks: Parsed[] ): number[] {
	const ids: number[] = [];
	walk( blocks, ( b ) => {
		const ref = Number( b.attributes?.ref );
		if ( b.name === 'core/navigation' && Number.isInteger( ref ) && ref > 0 ) ids.push( ref );
		return true;
	} );
	return [ ...new Set( ids ) ];
}
