/**
 * The Layers panel's decisions, kept apart from its markup so they are testable without a DOM:
 * which rows show, what each row says, and which blocks can be grouped or ungrouped.
 */
import type { BlockNode } from './mount';

/** The screen sizes a block can be hidden on, as the `visibility` attribute keys them. */
export const SCREENS = [ 'base', 'tablet', 'mobile' ] as const;
export type Screen = ( typeof SCREENS )[ number ];

/** Blocks whose children can be lifted out, which is what Ungroup does. */
export const UNGROUPABLE = new Set( [ 'blicks/box' ] );

/** The block Group wraps a selection in. */
export const GROUP_BLOCK = 'blicks/box';

export interface LayerRow {
	id: string;
	name: string;
	/** The block type's title, shown when the author has not named the block. */
	title: string;
	icon: unknown;
	depth: number;
	parent: string;
	/** How many blocks are directly inside it. */
	children: number;
	/** What the row holds, so ten Headings in a row are ten different rows. */
	snippet: string;
	/** The author's own name for the block (`metadata.name`), or ''. */
	label: string;
	locked: boolean;
	/** Screens the block is hidden on. */
	hidden: Screen[];
}

export interface BlockTypeLookup {
	getBlockType: ( name: string ) => { title?: string; icon?: unknown } | undefined;
}

/**
 * A row's content in a few words: a heading's text, a button's label, a box's kind.
 *
 * Text is read from the attribute and stripped of markup rather than rendered, so a bold word in a
 * heading cannot turn into markup in the rail.
 */
export function snippetOf( node: BlockNode, strip: ( html: string ) => string ): string {
	const attributes = ( node.attributes ?? {} ) as Record< string, unknown >;
	const kind = attributes.kind;

	if ( typeof kind === 'string' && '' !== kind && 'plain' !== kind ) {
		return kind;
	}

	for ( const key of [ 'content', 'text', 'label' ] ) {
		const value = attributes[ key ];

		if ( typeof value === 'string' && '' !== value ) {
			return strip( value ).replace( /\s+/g, ' ' ).trim();
		}
	}

	return '';
}

const labelOf = ( attributes: Record< string, unknown > ): string => {
	const meta = attributes.metadata as { name?: unknown } | undefined;

	return typeof meta?.name === 'string' ? meta.name : '';
};

const lockedOf = ( attributes: Record< string, unknown > ): boolean => {
	const lock = attributes.lock as { move?: unknown; remove?: unknown } | undefined;

	return !! ( lock?.move || lock?.remove );
};

const hiddenOf = ( attributes: Record< string, unknown > ): Screen[] => {
	const visibility = ( attributes.visibility ?? {} ) as Record< string, unknown >;

	return SCREENS.filter( ( screen ) => !! visibility[ screen ] );
};

/** Every block in the tree as a row, depth-first, with nothing hidden. */
export function flatten( blocks: BlockNode[], types: BlockTypeLookup, strip: ( html: string ) => string ): LayerRow[] {
	const rows: LayerRow[] = [];

	const walk = ( nodes: BlockNode[], depth: number, parent: string ): void => {
		for ( const node of nodes ) {
			const attributes = ( node.attributes ?? {} ) as Record< string, unknown >;
			const type = types.getBlockType( node.name );
			const id = node.clientId ?? '';

			rows.push( {
				id,
				name: node.name,
				title: type?.title ?? node.name,
				icon: type?.icon,
				depth,
				parent,
				children: ( node.innerBlocks ?? [] ).length,
				snippet: snippetOf( node, strip ),
				label: labelOf( attributes ),
				locked: lockedOf( attributes ),
				hidden: hiddenOf( attributes ),
			} );

			walk( node.innerBlocks ?? [], depth + 1, id );
		}
	};

	walk( blocks, 0, '' );

	return rows;
}

/**
 * The rows to draw.
 *
 * With a query, every row that matches shows, collapsed or not, so a search never misses a block
 * folded away inside a group — by its name, or by a style value Find matched in it (`hits`, the
 * design panel's matches). Without one, the descendants of a collapsed row are left out.
 */
export function visibleRows( rows: LayerRow[], collapsed: ReadonlySet< string >, query: string, hits: ReadonlySet< string > = new Set() ): LayerRow[] {
	const q = query.trim().toLowerCase();

	if ( '' !== q ) {
		return rows.filter( ( row ) => hits.has( row.id ) || `${ row.label } ${ row.title } ${ row.snippet }`.toLowerCase().includes( q ) );
	}

	const out: LayerRow[] = [];
	let foldedBelow = -1;

	for ( const row of rows ) {
		if ( foldedBelow >= 0 && row.depth > foldedBelow ) {
			continue;
		}

		foldedBelow = collapsed.has( row.id ) && row.children > 0 ? row.depth : -1;
		out.push( row );
	}

	return out;
}

/** Whether these blocks can be wrapped in one Box: two or more, side by side under one parent. */
export function canGroup( ids: readonly string[], rows: readonly LayerRow[] ): boolean {
	if ( ids.length < 2 ) {
		return false;
	}

	const picked = rows.filter( ( row ) => ids.includes( row.id ) );

	return picked.length === ids.length && picked.every( ( row ) => row.parent === picked[ 0 ]!.parent && ! row.locked );
}

/** Whether a block's children can be lifted out in its place. */
export function canUngroup( row: LayerRow | undefined ): boolean {
	return !! row && UNGROUPABLE.has( row.name ) && row.children > 0 && ! row.locked;
}

/**
 * The attributes the Group box starts with.
 *
 * Inside a Button everything saves inline, and the editor rewrites a block that is not — as a
 * separate edit. In the Studio that edit is its own history step, so Undo would take back only the
 * rewrite, the editor would redo it, and the group could never be undone. Starting the box inline
 * leaves the editor nothing to fix. (The rule mirrors `blocks/button/content.ts`, which this bundle
 * may not import.)
 */
export function groupAttributes( ids: readonly string[], rows: readonly LayerRow[] ): Record< string, unknown > {
	const byId = new Map( rows.map( ( row ) => [ row.id, row ] ) );
	let at = byId.get( ids[ 0 ] ?? '' )?.parent ?? '';

	while ( at ) {
		const row = byId.get( at );
		if ( ! row ) break;
		if ( 'blicks/button' === row.name ) return { tag: 'span' };
		at = row.parent;
	}

	return {};
}

/** The selected ids in tree order — the order Group must keep them in. */
export function inTreeOrder( ids: readonly string[], rows: readonly LayerRow[] ): string[] {
	return rows.filter( ( row ) => ids.includes( row.id ) ).map( ( row ) => row.id );
}
