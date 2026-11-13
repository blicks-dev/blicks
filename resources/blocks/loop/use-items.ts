/**
 * The items a Loop shows in the editor, from the server.
 *
 * The editor never fetches an endpoint or runs a query: it posts the Loop's data settings to
 * `blicks/v1/loop/items`, which runs the same code as the page (src/Data/Loop.php). Requests are
 * debounced while someone types JSON and keyed by the settings, so an unrelated attribute change
 * (a layout, a rule) never refetches.
 *
 * The preview position — "item 3 of 8" — is shared between the canvas and the panel through a tiny
 * store keyed by the Loop's clientId, so stepping it in the panel moves the template on the canvas.
 * A paged Loop's previewed page is kept the same way: its page links on the canvas step it.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { useSelect } from '@wordpress/data';
import type { Item } from './data';

export interface LoopItems {
	items: Item[];
	fields: Array< { key: string; type: string } >;
	lists: Array< { path: string; count: number } >;
	total: number;
	matched: number;
	path: string;
	endpoint: { fetchedAt: number; stale: boolean; error: string } | null;
	/** The page previewed, how many there are, their size, every page's items together, and how many come before this one. */
	page: number;
	pages: number;
	perPage: number;
	found: number;
	from: number;
}

export interface ItemsState {
	data: LoopItems | null;
	error: string;
	loading: boolean;
	refresh: () => void;
}

/**
 * The attributes that decide which items come back; everything else is layout. Every key
 * `LoopAttributes::sanitize()` reads belongs here, or the editor previews items the page won't show
 * (a registered source's settings, `sourceArgs`, were missing: changing them never reached the preview).
 */
export const DATA_KEYS = [ 'source', 'sourceArgs', 'data', 'path', 'endpoint', 'query', 'limit', 'offset', 'sort', 'filter', 'pagination' ] as const;

export function dataAttributes( attributes: Record< string, unknown > ): Record< string, unknown > {
	const out: Record< string, unknown > = {};
	for ( const key of DATA_KEYS ) {
		if ( attributes[ key ] !== undefined ) out[ key ] = attributes[ key ];
	}
	return out;
}

const cache = new Map< string, LoopItems >();

/** The built-in source for a Loop inside a card: a list of the card's item (src/Data/ItemSource.php). */
export const ITEM_SOURCE = 'item';

/** A source another plugin registered: `vendor/name` (`LoopSources::ID`). */
export function isRegisteredSource( source: unknown ): boolean {
	return typeof source === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test( source );
}

/**
 * `null` is "not in a Loop": nothing is fetched. A bindable block outside a Loop (and every block in
 * a design preview) calls this too, and used to post empty attributes on each mount for a 422.
 *
 * `parent` is the card item a Loop with the `item` source repeats over a list of; it is sent with
 * the request, so the server's own code reads the list, filters, sorts and limits it. Until there is
 * one (outside any Loop card) nothing is fetched. A registered source inside a card gets it too, as
 * `$context['parent']`; outside a card it fetches without one.
 */
export function useLoopItems( attributes: Record< string, unknown > | null, page = 1, parent?: Item ): ItemsState {
	const postId = useSelect( ( select: any ) => select( 'core/editor' )?.getCurrentPostId?.() ?? 0, [] );
	// Only a paged Loop has pages, so an unpaged one shares its cache entry with every caller.
	const at = attributes?.pagination ? Math.max( 1, page ) : 1;
	const nested = attributes?.source === ITEM_SOURCE;
	// What reads the card around the Loop: the `item` source, and a registered one in a card.
	const withParent = nested || ( isRegisteredSource( attributes?.source ) && parent !== undefined );
	const key = attributes && ( ! nested || parent ) ? JSON.stringify( [ dataAttributes( attributes ), postId, at, withParent ? parent : null ] ) : '';
	const [ state, setState ] = useState< { key: string; data: LoopItems | null; error: string; loading: boolean } >( () => ( {
		key,
		data: cache.get( key ) ?? null,
		error: '',
		loading: key !== '' && ! cache.has( key ),
	} ) );
	const [ nonce, setNonce ] = useState( 0 );
	const latest = useRef( key );
	latest.current = key;

	useEffect( () => {
		if ( key === '' ) {
			setState( { key, data: null, error: '', loading: false } );
			return;
		}
		const force = nonce > 0;
		if ( ! force && cache.has( key ) ) {
			setState( { key, data: cache.get( key )!, error: '', loading: false } );
			return;
		}
		setState( ( s ) => ( { ...s, key, loading: true } ) );
		// Typing in the JSON box changes `data` on every key: wait for a pause.
		const timer = setTimeout( () => {
			( apiFetch( {
				path: '/blicks/v1/loop/items',
				method: 'POST',
				data: { attributes: dataAttributes( attributes ?? {} ), postId: Number( postId ) || 0, page: at, refresh: force, ...( withParent ? { parent } : {} ) },
			} ) as Promise< LoopItems > )
				.then( ( data ) => {
					cache.set( key, data );
					if ( latest.current === key ) setState( { key, data, error: '', loading: false } );
				} )
				.catch( ( e: any ) => {
					if ( latest.current === key ) setState( { key, data: null, error: String( e?.message || 'The items could not be loaded.' ), loading: false } );
				} );
		}, force || nested ? 0 : 400 );
		return () => clearTimeout( timer );
		// `attributes` is read through `key`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ key, nonce ] );

	return {
		data: state.key === key ? state.data : cache.get( key ) ?? state.data,
		error: state.key === key ? state.error : '',
		loading: state.loading,
		refresh: () => {
			cache.delete( key );
			setNonce( ( n ) => n + 1 );
		},
	};
}

/* ---------- the shared preview position ---------- */

const positions = new Map< string, number >();
const listeners = new Set< () => void >();

export function setPreview( clientId: string, index: number ): void {
	positions.set( clientId, Math.max( 0, index ) );
	listeners.forEach( ( l ) => l() );
}

export function usePreview( clientId: string | undefined, count: number ): number {
	const value = useSyncExternalStore(
		( l ) => {
			listeners.add( l );
			return () => listeners.delete( l );
		},
		() => positions.get( clientId ?? '' ) ?? 0
	);
	return Math.max( 0, Math.min( value, count - 1 ) );
}

const pages = new Map< string, number >();

export function setPreviewPage( clientId: string, page: number ): void {
	pages.set( clientId, Math.max( 1, page ) );
	listeners.forEach( ( l ) => l() );
}

/** The page of a paged Loop the editor previews; 1 until its page links are used. */
export function usePreviewPage( clientId: string | undefined ): number {
	return useSyncExternalStore(
		( l ) => {
			listeners.add( l );
			return () => listeners.delete( l );
		},
		() => pages.get( clientId ?? '' ) ?? 1
	);
}
