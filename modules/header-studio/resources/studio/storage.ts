/**
 * Where a header is kept: a block theme template part in the `header` area, read and written through
 * the free plugin's entity route (`window.blicks.studio.entity`), which checks `edit_theme_options`
 * and writes a theme's own part as a customised copy, as the Site Editor does.
 *
 * A part that is not a Header Studio header yet (the theme's own) opens converted: its logo, title,
 * menu and buttons in a Classic header (./convert.ts). Nothing is written until Save header.
 */
import apiFetch from '@wordpress/api-fetch';
import { createBlocksFromInnerBlocksTemplate, parse } from '@wordpress/blocks';
import { dispatch } from '@wordpress/data';
import { __, _n, sprintf } from '@wordpress/i18n';
import { convertHeader, menuRefs, type Parsed } from './convert';
import { partId, type Block, type Loaded, type Ref, type StudioHost } from './host';
import { isHeader } from './tree';

type NavRecord = { id: number; content?: { raw?: string } };
type PageRecord = { title?: { rendered?: string }; link?: string };

/** The Navigation menus a theme header names, and the site's fallback as `0`. */
async function menus( blocks: Parsed[] ): Promise< Record< number, Parsed[] > > {
	const found: Record< number, Parsed[] > = {};

	for ( const id of menuRefs( blocks ) ) {
		const nav = ( await apiFetch( { path: `/wp/v2/navigation/${ id }?context=edit` } ).catch( () => null ) ) as NavRecord | null;
		if ( nav?.content?.raw ) found[ id ] = parse( nav.content.raw ) as Parsed[];
	}

	// What a Navigation block with no menu of its own shows: the latest menu, else the pages. A menu
	// that is only a Page List is the pages too.
	const [ latest ] = ( ( await apiFetch( { path: '/wp/v2/navigation?context=edit&per_page=1&status=publish' } ).catch( () => [] ) ) ?? [] ) as NavRecord[];
	const fallback = latest?.content?.raw ? ( parse( latest.content.raw ) as Parsed[] ) : [];
	const hasLinks = ( blocks: Parsed[] ) => blocks.some( ( b ) => b.name === 'core/navigation-link' || b.name === 'core/navigation-submenu' );

	if ( hasLinks( fallback ) ) {
		found[ 0 ] = fallback;
	} else {
		const pages = ( ( await apiFetch( { path: '/wp/v2/pages?per_page=6&orderby=menu_order&order=asc&_fields=title,link' } ).catch( () => [] ) ) ?? [] ) as PageRecord[];
		found[ 0 ] = pages.map( ( p ) => ( { name: 'core/navigation-link', attributes: { label: String( p.title?.rendered ?? '' ), url: String( p.link ?? '' ) } } ) );
	}

	for ( const id of Object.keys( found ).map( Number ) ) {
		if ( id && ! hasLinks( found[ id ] ) ) found[ id ] = found[ 0 ];
	}

	return found;
}

/**
 * A theme part is often only a reference to a pattern (`<!-- wp:pattern {"slug":…} /-->`, as
 * Twenty Twenty-Five's header is): put the pattern's own blocks in its place, once.
 */
async function expandPatterns( blocks: Parsed[] ): Promise< Parsed[] > {
	if ( ! blocks.some( ( b ) => b.name === 'core/pattern' ) ) return blocks;

	const patterns = ( ( await apiFetch( { path: '/wp/v2/block-patterns/patterns' } ).catch( () => [] ) ) ?? [] ) as { name: string; content: string }[];

	return blocks.flatMap( ( b ) => {
		if ( b.name !== 'core/pattern' ) return [ b ];
		const found = patterns.find( ( p ) => p.name === b.attributes?.slug );
		return found ? ( parse( found.content ) as Parsed[] ) : [];
	} );
}

/** The loaded tree as a header: unchanged if it is one, converted if not. */
export async function asHeader( loaded: Loaded ): Promise< Loaded > {
	if ( isHeader( loaded.blocks ) ) return loaded;

	const theirs = await expandPatterns( loaded.blocks as Parsed[] );
	const { template, dropped } = convertHeader( theirs, await menus( theirs ) );
	const blocks = createBlocksFromInnerBlocksTemplate( [ template as never ] ) as unknown as Block[];
	const made = dropped.length
		? sprintf(
				/* translators: %s: block names, e.g. "core/search, core/social-links" */
				_n( 'Made from your theme’s header; %s had no place and was left out.', 'Made from your theme’s header; %s had no place and were left out.', dropped.length, 'blicks-pro' ),
				dropped.join( ', ' )
		  )
		: __( 'Made from your theme’s header. Nothing is saved until you save it.', 'blicks-pro' );

	return { ...loaded, blocks, note: [ loaded.note, made ].filter( Boolean ).join( ' · ' ) };
}

/** Tell the editor around the Studio (the Site Editor) that the part changed under it. */
function refreshEditor( id: string ): void {
	const core = dispatch( 'core' ) as unknown as { invalidateResolution?: ( selector: string, args: unknown[] ) => void };
	for ( const selector of [ 'getEntityRecord', 'getEditedEntityRecord' ] ) {
		core.invalidateResolution?.( selector, [ 'postType', 'wp_template_part', id ] );
	}
}

export function persist( host: StudioHost ) {
	return {
		label: __( 'Save header', 'blicks-pro' ),
		async load( ref: Ref ): Promise< Loaded > {
			return asHeader( await host.entity.load( ref ) );
		},
		async save( blocks: Block[], ref: Ref ): Promise< unknown > {
			const saved = await host.entity.save( blocks, ref );
			const id = partId( ref );
			if ( id ) refreshEditor( id );
			return saved;
		},
	};
}
