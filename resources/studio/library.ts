/**
 * Four sources, five collections, one shelf.
 *
 * The library carries two jobs that pull in different directions, and both are in the model rather
 * than in whichever screen happens to be showing it.
 *
 * **Provenance** — where a pattern came from and whether editing it is safe. The rule that keeps it
 * honest: *nothing you did not author is writable in place.* Editing a built-in or a fetched
 * pattern and saving makes a copy on this site, so a plugin update can never overwrite someone's
 * work and their library can never drift from what shipped. That is a property of where a pattern
 * came from, which is why `source` is on the entry.
 *
 * **Coherence** — whether two patterns taken off this shelf will look like one page. A pattern
 * belongs to a `collection`: a set with one palette, one type scale and one radius, declared in
 * `collections.ts`. Without it a library is a pile, and mounting a hero from one place and a
 * pricing table from another produces a page that looks assembled rather than designed.
 *
 * The two axes are independent and must stay so. A collection says what a pattern LOOKS like; a
 * source says who may overwrite it. A site's own saved patterns are in no collection at all, which
 * is not a gap — they are whatever their author made them.
 *
 * Nothing here fetches. Each source hands in its own entries and this merges, counts and filters
 * them, so one failing source cannot take the shelf down with it and the whole model is testable
 * without a WordPress or a network.
 */

import { COLLECTIONS, type Collection } from './collections';
import type { BlockNode } from './mount';
import type { Keyframes } from './motion/keyframes';

/** Where a pattern came from. `all` is a filter, never an entry's own value. */
export type SourceId = 'builtin' | 'site' | 'dev' | 'imported';
export type SourceFilter = SourceId | 'all';

export interface PatternEntry {
	/** Unique across the whole shelf, so a site pattern and a built-in cannot collide. */
	id: string;
	title: string;
	source: SourceId;
	/**
	 * The set it belongs to, by `Collection.id`, or absent.
	 *
	 * Absent is the normal state for a pattern someone saved here: it is their own work, in their
	 * own look, and filing it under a shipped set would be a claim about it that nobody made.
	 */
	collection?: string;
	/** The category it files under, or empty. Free text — it comes from the site's own taxonomy. */
	kind: string;
	/** The store's own group slug (`cards`, `buttons`…), for a store entry: `kind` is its translated name. */
	groupSlug?: string;
	/** The tree, when it is already in hand. Serialized markup is parsed lazily instead. */
	blocks: BlockNode[] | null;
	/** Saved markup, for a source that stores patterns as posts. */
	content?: string;
	/**
	 * Present on the shelf but not mountable here — a pattern needing a plugin this site lacks.
	 *
	 * Kept visible rather than filtered out, so the catalogue reads the same on every site. A
	 * pattern that silently disappears teaches people the library is unreliable.
	 */
	locked?: boolean;
	/** Why it is locked, in a few words. Empty when it is not. */
	lockedReason?: string;
	/** Taxonomy term ids, before they are joined to names. */
	categoryIds?: number[];
	/** Custom keyframes the pattern carries, for the blocks in it that name them. */
	keyframes?: Keyframes[];
	/** A picture to show while there is no tree to draw — a remote entry's preview. */
	image?: string;
	/** A paid entry, badged on its card. */
	tier?: 'free' | 'pro';
	/** A live preview page to frame — a remote entry's design, running, before it is opened. */
	frame?: string;
	/** One line on what it is, from its source. */
	excerpt?: string;
	/** static, animated or interactive, from its source. */
	motion?: string;
	/** Fetch the tree, for an entry that does not hold one (a remote source's). */
	open?: () => Promise< { blocks: BlockNode[]; keyframes?: Keyframes[] } >;
}

/** What a source hands over, including the state where it could not. */
export interface SourceResult {
	source: SourceId;
	entries: PatternEntry[];
	/** Set when this source failed. The rest of the shelf is unaffected. */
	error?: string;
	/** A link that fixes it, where there is one: the Marketplace's switch while it is off. */
	action?: { label: string; href: string };
}

/** Writable in place, or only as a copy. */
export function isWritable( entry: PatternEntry ): boolean {
	return entry.source === 'site';
}

/**
 * A one-line description of a tree's shape, for the card.
 *
 * Structure rather than prose: "Section · 4 blocks" tells you what you are about to mount. A
 * description someone typed tells you what they hoped it was.
 */
export function describe( blocks: BlockNode[] | null ): string {
	if ( ! blocks || blocks.length === 0 ) {
		return '';
	}

	let count = 0;
	const walk = ( nodes: BlockNode[] ): void => {
		for ( const node of nodes ) {
			count += 1;
			walk( node.innerBlocks ?? [] );
		}
	};

	walk( blocks );

	const root = ( blocks[ 0 ]!.name ?? '' ).replace( /^[a-z-]+\//, '' );

	return `${ root } · ${ count } ${ count === 1 ? 'block' : 'blocks' }`;
}

/** Merge what the sources returned, in shelf order. */
export function shelve( results: SourceResult[] ): PatternEntry[] {
	const order: SourceId[] = [ 'builtin', 'site', 'dev', 'imported' ];

	return order.flatMap(
		( source ) => results.find( ( r ) => r.source === source )?.entries ?? []
	);
}

/** How many each source contributed, plus the total under `all`. */
export function countsBySource( entries: PatternEntry[] ): Record< SourceFilter, number > {
	const counts: Record< SourceFilter, number > = {
		all: entries.length,
		builtin: 0,
		site: 0,
		dev: 0,
		imported: 0,
	};

	for ( const entry of entries ) {
		counts[ entry.source ] += 1;
	}

	return counts;
}

/**
 * The collections present on the shelf, with counts, in the order they ship.
 *
 * **Table order, not count order** — unlike `kindsOf`. A collection is curated and its position is
 * part of the curation; a shelf that reordered itself as patterns were added would teach people
 * that the first set is the biggest rather than the one to start with. Kinds have no such claim:
 * they are whatever a site happened to file things under, so they sort by use.
 *
 * Collections with nothing on the shelf are left out, same as kinds. A row that filters to an empty
 * grid is a dead end the rail could have declined to offer.
 */
export function collectionsOf(
	entries: PatternEntry[],
	table: Collection[] = COLLECTIONS
): { collection: Collection; count: number }[] {
	const counts = new Map< string, number >();

	for ( const entry of entries ) {
		if ( entry.collection ) {
			counts.set( entry.collection, ( counts.get( entry.collection ) ?? 0 ) + 1 );
		}
	}

	return table
		.filter( ( collection ) => counts.has( collection.id ) )
		.map( ( collection ) => ( { collection, count: counts.get( collection.id )! } ) );
}

/**
 * The industries present, with counts.
 *
 * An industry is carried by the COLLECTION, so this counts patterns whose collection claims it — a
 * pattern in no collection has no industry and is counted nowhere here. That is why the rail must
 * never present industry as the only way through the shelf: it cannot reach a site's own work.
 *
 * A collection claiming two industries contributes its patterns to both. These are overlapping
 * audiences, not a partition, and summing the counts past the total is correct rather than a bug.
 */
export function industriesOf(
	entries: PatternEntry[],
	table: Collection[] = COLLECTIONS
): { industry: string; count: number }[] {
	const counts = new Map< string, number >();
	const order: string[] = [];

	for ( const entry of entries ) {
		const collection = collectionFrom( entry, table );

		if ( ! collection ) {
			continue;
		}

		for ( const industry of collection.industries ) {
			if ( ! counts.has( industry ) ) {
				order.push( industry );
			}

			counts.set( industry, ( counts.get( industry ) ?? 0 ) + 1 );
		}
	}

	return order
		.map( ( industry ) => ( { industry, count: counts.get( industry )! } ) )
		.sort( ( a, b ) => b.count - a.count || a.industry.localeCompare( b.industry ) );
}

/**
 * The kinds present, with counts, most used first.
 *
 * Derived from what is passed in rather than from a fixed list, which is what lets the screen hand
 * it the entries of ONE collection and get that collection's kinds — "3 heroes, 2 pricing" meaning
 * three heroes *in Funky*. A global count beside a collection-scoped grid is a number that
 * contradicts what is on screen.
 */
export function kindsOf( entries: PatternEntry[] ): { kind: string; count: number }[] {
	const counts = new Map< string, number >();

	for ( const entry of entries ) {
		if ( entry.kind !== '' ) {
			counts.set( entry.kind, ( counts.get( entry.kind ) ?? 0 ) + 1 );
		}
	}

	return [ ...counts.entries() ]
		.map( ( [ kind, count ] ) => ( { kind, count } ) )
		.sort( ( a, b ) => b.count - a.count || a.kind.localeCompare( b.kind ) );
}

export interface LibraryFilter {
	source: SourceFilter;
	/** A `Collection.id`. Empty means every collection, including patterns in none. */
	collection: string;
	/** Empty means every industry. Matched against the entry's COLLECTION, not the entry. */
	industry: string;
	/** Empty means every kind. */
	kind: string;
	/** Empty means no search. Matched against the title, the kind and the collection's name. */
	query: string;
}

/** A filter with nothing narrowed, for a fresh screen and for tests that vary one axis. */
export const NO_FILTER: LibraryFilter = {
	source: 'all',
	collection: '',
	industry: '',
	kind: '',
	query: '',
};

/**
 * Narrow the shelf.
 *
 * Search covers the title, the kind and the collection's name — which is what people actually type:
 * "hero", "pricing", "funky". Deliberately not the block names inside, because matching a tree's
 * internals surfaces patterns whose relevance nobody can see from the card.
 */
export function filterLibrary(
	entries: PatternEntry[],
	filter: LibraryFilter,
	table: Collection[] = COLLECTIONS
): PatternEntry[] {
	const query = filter.query.trim().toLowerCase();

	return entries.filter( ( entry ) => {
		if ( filter.source !== 'all' && entry.source !== filter.source ) {
			return false;
		}

		if ( filter.collection !== '' && entry.collection !== filter.collection ) {
			return false;
		}

		const collection = collectionFrom( entry, table );

		if ( filter.industry !== '' && ! collection?.industries.includes( filter.industry ) ) {
			return false;
		}

		if ( filter.kind !== '' && entry.kind !== filter.kind ) {
			return false;
		}

		if ( query === '' ) {
			return true;
		}

		return (
			entry.title.toLowerCase().includes( query ) ||
			entry.kind.toLowerCase().includes( query ) ||
			( collection?.name.toLowerCase().includes( query ) ?? false )
		);
	} );
}

/** True when any axis is narrowing the shelf. */
export function isFiltered( filter: LibraryFilter ): boolean {
	return (
		filter.source !== 'all' ||
		filter.collection !== '' ||
		filter.industry !== '' ||
		filter.kind !== '' ||
		filter.query.trim() !== ''
	);
}

/**
 * Which empty this is.
 *
 * Each of these needs a different sentence, and the same blank grid for all of them is the answer
 * that helps nobody. A first run gets the one instruction that fixes it forever. A dead-end search
 * gets the term back to edit. A combination nobody has a pattern for — "pricing, in Funky" — gets
 * the facets back, which is a different fix from clearing a search box nobody typed in.
 *
 * Order matters. The query is checked first because a person who typed something believes that is
 * why the grid is empty, and telling them instead that Funky has no pricing answers a question they
 * did not ask.
 */
export type EmptyKind = 'none' | 'first-run' | 'no-results' | 'filtered-out' | 'source-empty';

export function emptyKindFor(
	shown: PatternEntry[],
	all: PatternEntry[],
	filter: LibraryFilter
): EmptyKind {
	if ( shown.length > 0 ) {
		return 'none';
	}

	if ( all.length === 0 && ! isFiltered( filter ) ) {
		return 'first-run';
	}

	if ( filter.query.trim() !== '' ) {
		return 'no-results';
	}

	if ( filter.collection !== '' || filter.industry !== '' || filter.kind !== '' ) {
		return 'filtered-out';
	}

	if ( filter.source !== 'all' ) {
		return 'source-empty';
	}

	return all.length === 0 ? 'first-run' : 'no-results';
}

/** The collection an entry belongs to, or `undefined` when it is in none. */
export function collectionFrom(
	entry: PatternEntry,
	table: Collection[] = COLLECTIONS
): Collection | undefined {
	return entry.collection ? table.find( ( c ) => c.id === entry.collection ) : undefined;
}

/** One bar in a card's preview: a share of the width, a share of the height, and whether it leads. */
export interface PreviewBar {
	width: number;
	height: number;
	lead: boolean;
}

/**
 * A pattern's shape, as bars.
 *
 * Structure, not a screenshot — what you are choosing between on a shelf is how a composition is
 * built, and a 230px picture of finished text tells you nothing you can act on. Derived from the
 * tree, so it can never go stale the way a stored image does the moment the pattern is edited.
 *
 * The bars are PAINTED in the collection's palette by the card, which is what makes a set read as a
 * set at a glance. Shape from the tree, colour from the collection: neither is a stored copy of the
 * other, and a pattern cannot look like it belongs to a set it is not in.
 *
 * Reads the first container's children rather than the roots. A pattern is almost always one
 * section wrapping the thing worth seeing, so drawing the roots gives every card the same single
 * full-width bar.
 */
export function previewBars( blocks: BlockNode[] | null, limit = 4 ): PreviewBar[] {
	if ( ! blocks || blocks.length === 0 ) {
		return [];
	}

	// Descend while there is exactly one child, which is the wrapper case.
	let level = blocks;

	while ( level.length === 1 && ( level[ 0 ]!.innerBlocks ?? [] ).length > 0 ) {
		level = level[ 0 ]!.innerBlocks!;
	}

	const shown = level.slice( 0, limit );

	if ( shown.length === 0 ) {
		return [];
	}

	// Heights vary with how much each child contains, so a card distinguishes a row of equal cards
	// from a heading over a paragraph without knowing anything about either.
	const weight = ( node: BlockNode ): number => ( node.innerBlocks ?? [] ).length;
	const heaviest = Math.max( 1, ...shown.map( weight ) );

	return shown.map( ( node, index ) => ( {
		width: Math.round( ( 100 - ( shown.length - 1 ) * 6 ) / shown.length ),
		height: 45 + Math.round( ( weight( node ) / heaviest ) * 45 ),
		lead: index === 0,
	} ) );
}
