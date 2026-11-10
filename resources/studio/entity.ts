/**
 * The browser half of `Blicks\Studio\EntityRef`: load and save a stored entity's blocks.
 *
 * A mode that persists to a template part or to a post of its own type does not need its own
 * REST code. It spreads these into its `persist`:
 *
 *     persist: { label: __( 'Save header', 'blicks-pro' ), ...window.blicks.studio.entity }
 *
 * and opens one with `studio.openRef( 'header', { kind: 'template-part', id: 'theme//header' } )`.
 * The server checks the capability for the entity, never this file.
 */

import type { BlockNode } from './mount';
import type { PersistLoad, StudioRef } from './registry';

/** What `blicks/v1/studio/entity` answers with. */
export interface EntityRecord {
	content: string;
	title: string;
	usedOn: { id: string; title: string; kind: string }[];
}

type Fetch = ( options: { path: string; method?: string; data?: unknown } ) => Promise< unknown >;

export const ENTITY_PATH = '/blicks/v1/studio/entity';

/** The ref's fields the route reads, as a query string. Anything else in the ref stays local. */
export function entityQuery( ref: StudioRef ): string {
	const query = new URLSearchParams();

	for ( const key of [ 'kind', 'id', 'type' ] ) {
		const value = ref[ key ];

		if ( 'string' === typeof value || 'number' === typeof value ) {
			query.set( key, String( value ) );
		}
	}

	return query.toString();
}

/** "Used on 12 pages", or '' when nothing is known to use it. */
export function usedOnNote( usedOn: EntityRecord[ 'usedOn' ], word: ( count: number ) => string ): string {
	return usedOn.length > 0 ? word( usedOn.length ) : '';
}

export function entityPersist(
	fetch: Fetch,
	parse: ( content: string ) => BlockNode[],
	serialize: ( blocks: BlockNode[] ) => string,
	word: ( count: number ) => string
): { load: ( ref: StudioRef ) => Promise< PersistLoad >; save: ( blocks: BlockNode[], ref: StudioRef ) => Promise< EntityRecord > } {
	return {
		async load( ref: StudioRef ): Promise< PersistLoad > {
			const record = ( await fetch( { path: `${ ENTITY_PATH }?${ entityQuery( ref ) }` } ) ) as EntityRecord;

			return {
				blocks: parse( String( record?.content ?? '' ) ),
				label: String( record?.title ?? '' ),
				note: usedOnNote( Array.isArray( record?.usedOn ) ? record.usedOn : [], word ),
			};
		},

		async save( blocks: BlockNode[], ref: StudioRef ): Promise< EntityRecord > {
			return ( await fetch( {
				path: `${ ENTITY_PATH }?${ entityQuery( ref ) }`,
				method: 'POST',
				data: { content: serialize( blocks ) },
			} ) ) as EntityRecord;
		},
	};
}
