/**
 * Who is holding the Studio open.
 *
 * The Studio cannot live inside the block toolbar, and the reason is not style. A `BlockControls`
 * fill renders only while its block is **selected**, and its `BlockEdit` only while the block
 * **exists** — so a Studio rendered in there is destroyed by selecting something else in the post
 * behind it, or by deleting the block it was opened from. Both were reproduced: removing the origin
 * block took the whole session with it, mid-edit, with no warning and nothing recoverable.
 *
 * That is also the case the Insert plan cares most about — "the origin is gone, fall through to the
 * picker and say why" — which the old shape could not even reach, because the thing meant to ask
 * the question had already been unmounted.
 *
 * So the session lives here, outside React, and one always-mounted root renders it. The toolbar
 * button becomes what it should always have been: a thing that signals, not a thing that hosts.
 *
 * Deliberately not a `@wordpress/data` store. There is one consumer, the state is two fields, and a
 * store would need registering into a registry — the registry question being exactly what the
 * Studio spends its effort keeping straight.
 */

import { useEffect, useState } from '@wordpress/element';
import type { Mount } from './mount';

export interface Session {
	/**
	 * What is mounted, or `null` while the library is up.
	 *
	 * One session covers both: the library is the Studio with nothing mounted, not a second screen
	 * that hands off to it. Choosing a pattern fills this in and the surface becomes a canvas, which
	 * is why mounting from the library needs no close-and-reopen.
	 */
	mount: Mount | null;
	/** Blocks waiting on a target, when Insert had to ask. */
	pending: Mount[ 'blocks' ] | null;
}

type Listener = ( session: Session | null ) => void;

let session: Session | null = null;
const listeners = new Set< Listener >();

function emit(): void {
	for ( const listener of listeners ) {
		listener( session );
	}
}

export function getSession(): Session | null {
	return session;
}

export function openSession( mount: Mount ): void {
	session = { mount, pending: null };
	emit();
}

/** Open with nothing mounted: the library. */
export function openLibrary(): void {
	session = { mount: null, pending: null };
	emit();
}

/** Insert asked a question. Hold the tree until it is answered. */
export function awaitTarget( blocks: Mount[ 'blocks' ] ): void {
	if ( ! session ) {
		return;
	}

	session = { ...session, pending: blocks };
	emit();
}

/** The question was dismissed. Stay mounted — cancelling Insert is not cancelling the session. */
export function clearTarget(): void {
	if ( ! session ) {
		return;
	}

	session = { ...session, pending: null };
	emit();
}

export function closeSession(): void {
	session = null;
	emit();
}

export function subscribe( listener: Listener ): () => void {
	listeners.add( listener );

	return () => {
		listeners.delete( listener );
	};
}

/**
 * Subscribe a component to the session.
 *
 * Exists so the toolbar item can disappear while the Studio is open. That button is added by a
 * filter on every Blicks block's `BlockEdit`, and the Studio renders Blicks blocks — so it appears
 * on the blocks INSIDE the Studio too, offering to open a Studio from within one. There is nothing
 * sensible for it to do there, and the post editor behind cannot be reached anyway.
 */
export function useSession(): Session | null {
	const [ current, setCurrent ] = useState< Session | null >( () => getSession() );

	useEffect( () => subscribe( setCurrent ), [] );

	return current;
}
