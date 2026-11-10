/**
 * Saving a composition to this site.
 *
 * **Patterns are `wp_block` posts, not a table of our own.** The plan left this open; core settles
 * it. `wp_block` is registered for REST at `/wp/v2/blocks`, carries `wp_pattern_sync_status` as
 * registered meta and `wp_pattern_category` as a taxonomy, and WordPress already gives users a
 * place to rename, delete and export them. A Blicks CPT would mean a provider, a REST controller,
 * a capability map and a management screen, to arrive somewhere worse: work trapped inside the
 * Studio instead of reachable from the inserter like everything else they have saved.
 *
 * **The sync status is asymmetric in core's REST API, and it has two traps.** It is WRITTEN as
 * `meta.wp_pattern_sync_status` and READ as a TOP-LEVEL `wp_pattern_sync_status` field — the `meta`
 * object in a response carries only `footnotes`. And the top-level field is COMPUTED from meta
 * while the response is prepared, so a `_fields` list that omits `meta` gets an empty string back
 * rather than the status. Both failures look like "this site has no patterns".
 *
 * **Unsynced, deliberately.** A synced `wp_block` is a reference — change the pattern and every
 * post using it changes. That is a reusable block, which is a different feature with different
 * expectations. "Save as pattern" means "give me a copy of this to start from", so
 * `wp_pattern_sync_status: 'unsynced'` is the semantics, not a default worth inheriting.
 *
 * No thumbnail is stored. The library draws previews from the tree itself, so a stored image would
 * be a second copy of the truth, stale the moment the pattern is edited.
 *
 * Every function here takes its transport, so the decisions are testable without a WordPress.
 */

import type { BlockNode } from './mount';
import type { PatternEntry, SourceResult } from './library';
import type { Keyframes } from './motion/keyframes';

/** The slice of `apiFetch` used here. */
export type Fetcher = < T >( options: {
	path: string;
	method?: string;
	data?: unknown;
} ) => Promise< T >;

/** Turns blocks into the markup a `wp_block` stores. `serialize` from `@wordpress/blocks`. */
export type Serializer = ( blocks: BlockNode[] ) => string;

export interface PatternCategory {
	id: number;
	name: string;
}

export interface SavedPattern {
	id: number;
	title: string;
}

/** A pattern that cannot be saved, with the reason a person can act on. */
export class PatternError extends Error {
	constructor( message: string ) {
		super( message );
		this.name = 'PatternError';
	}
}

/**
 * The categories this site already uses.
 *
 * Existing terms only — the Studio does not invent taxonomy. A new category is a decision about how
 * a whole site is organised, and a composition tool is the wrong place to make it by typing.
 */
export async function listCategories( fetch: Fetcher ): Promise< PatternCategory[] > {
	const terms = await fetch< { id: number; name: string }[] >( {
		path: '/wp/v2/wp_pattern_category?per_page=100&_fields=id,name',
	} );

	return terms.map( ( term ) => ( { id: term.id, name: term.name } ) );
}

export interface SaveRequest {
	title: string;
	blocks: BlockNode[];
	/** A term id from `listCategories`, or null for uncategorised. */
	categoryId: number | null;
	/** The site's own keyframes the tree names, carried in the pattern's meta. */
	keyframes?: Keyframes[];
}

/** The `wp_block` meta key the free plugin registers for a pattern's keyframes. */
export const KEYFRAMES_META = 'blicks_keyframes';

/**
 * Write the composition to this site.
 *
 * Refuses an empty title and an empty canvas before touching the network: both produce a pattern
 * that exists and is useless, and the library has no way to tell the author why it is blank.
 *
 * Published rather than draft. A draft pattern does not appear in the inserter, which makes "saved"
 * a lie from the only place the author will look for it.
 */
export async function savePattern(
	request: SaveRequest,
	fetch: Fetcher,
	serialize: Serializer
): Promise< SavedPattern > {
	const title = request.title.trim();

	if ( '' === title ) {
		throw new PatternError( 'Give the pattern a name first.' );
	}

	if ( request.blocks.length === 0 ) {
		throw new PatternError( 'There is nothing on the canvas to save.' );
	}

	const saved = await fetch< { id: number; title?: { raw?: string } } >( {
		path: '/wp/v2/blocks',
		method: 'POST',
		data: {
			title,
			content: serialize( request.blocks ),
			status: 'publish',
			meta: {
				wp_pattern_sync_status: 'unsynced',
				...( request.keyframes?.length ? { [ KEYFRAMES_META ]: request.keyframes } : {} ),
			},
			...( request.categoryId ? { wp_pattern_category: [ request.categoryId ] } : {} ),
		},
	} );

	return { id: saved.id, title: saved.title?.raw ?? title };
}

/**
 * The human-readable part of a failure.
 *
 * `apiFetch` rejects with the REST error body — a plain `{ code, message }` object, not an `Error`.
 * Treating it as one puts `[object Object]` in front of the user, which is what the assistant
 * sidebar hit the first time it ran against a real site.
 */
export function messageFor( failure: unknown ): string {
	if ( failure instanceof Error ) {
		return failure.message;
	}

	if ( failure && typeof failure === 'object' && 'message' in failure ) {
		return String( ( failure as { message: unknown } ).message );
	}

	return String( failure );
}

/**
 * This site's own patterns, for the "Saved here" source.
 *
 * Asks for the unsynced ones. A synced `wp_block` is a reusable block — one shared instance across
 * every post that uses it — and mounting a copy of that in the Studio would be offering to edit
 * something whose whole point is that it is not copied. Core files both under the same post type,
 * so the distinction has to be made in the query rather than assumed.
 *
 * Markup rather than blocks: parsing every pattern to draw a shelf would mean building dozens of
 * trees to show a dozen cards. The tree is built when one is mounted.
 *
 * Returns a `SourceResult`, failure included, so a site where this call is refused still gets the
 * rest of the shelf — the library is never blank because one source did not answer.
 */
export async function loadSitePatterns( fetch: Fetcher ): Promise< SourceResult > {
	try {
		const posts = await fetch<
			{
				id: number;
				title?: { raw?: string; rendered?: string };
				content?: { raw?: string };
				wp_pattern_category?: number[];
				wp_pattern_sync_status?: string;
				meta?: Record< string, unknown >;
			}[]
		>( {
			// `meta` is requested even though nothing here reads it: core computes
			// `wp_pattern_sync_status` FROM meta while preparing the response, and `_fields`
			// filtering runs first. Leave `meta` out and the status comes back as an empty string
			// for every pattern — not missing, not an error, just silently wrong, which filters the
			// whole source to nothing.
			path:
				'/wp/v2/blocks?per_page=100&context=edit' +
				'&_fields=id,title,content,meta,wp_pattern_sync_status,wp_pattern_category',
		} );

		const entries: PatternEntry[] = posts
			.filter( ( post ) => 'unsynced' === post.wp_pattern_sync_status )
			.map( ( post ) => ( {
				id: `site:${ post.id }`,
				title: post.title?.raw ?? post.title?.rendered ?? '(untitled)',
				source: 'site' as const,
				kind: '',
				blocks: null,
				content: post.content?.raw ?? '',
				categoryIds: post.wp_pattern_category ?? [],
				...( Array.isArray( post.meta?.[ KEYFRAMES_META ] ) && ( post.meta[ KEYFRAMES_META ] as unknown[] ).length > 0
					? { keyframes: post.meta[ KEYFRAMES_META ] as Keyframes[] }
					: {} ),
			} ) );

		return { source: 'site', entries };
	} catch ( failure ) {
		return { source: 'site', entries: [], error: messageFor( failure ) };
	}
}

/**
 * Name the categories a site pattern files under.
 *
 * Separate from the fetch because the terms arrive as ids and the names come from a second
 * endpoint. Joining them here keeps both calls independent: a site whose taxonomy is unreadable
 * still gets its patterns, filed as uncategorised, rather than no patterns at all.
 */
export function withKinds(
	result: SourceResult,
	categories: PatternCategory[]
): SourceResult {
	const byId = new Map( categories.map( ( c ) => [ c.id, c.name ] ) );

	return {
		...result,
		entries: result.entries.map( ( entry ) => ( {
			...entry,
			kind: byId.get( ( entry.categoryIds ?? [] )[ 0 ] ?? -1 ) ?? '',
		} ) ),
	};
}
