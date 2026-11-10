/**
 * The focus scope: which block, if any, the Studio is narrowed to.
 *
 * Outside React for the same reason the session is (`session.ts`): a mode's canvas calls
 * `studio.focus()` from a button it draws, the shell reads it, and the published API has to reach
 * it with no component in hand. One value and a listener set; not a data store, for the reasons
 * `session.ts` gives.
 *
 * A scope belongs to one mount. Mounting something else, or closing the Studio, drops it, so a
 * scope can never point into a tree that is no longer there. A scope whose block is deleted while
 * focused is dropped by the shell, which is the only place that knows the tree.
 */

import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { focusScope, type FocusScope } from './registry';
import { getSession, subscribe as subscribeSession } from './session';
import type { Mount } from './mount';

type Listener = ( scope: FocusScope | null ) => void;

let scope: FocusScope | null = null;
const listeners = new Set< Listener >();

function set( next: FocusScope | null ): void {
	if ( next === scope ) {
		return;
	}

	scope = next;
	listeners.forEach( ( listener ) => listener( scope ) );
}

export function getFocus(): FocusScope | null {
	return scope;
}

/**
 * Narrow the Studio to one block's inner blocks. `studio.focus()` on the published API.
 *
 * Refused (false, and a console error naming why) with nothing mounted or with a malformed
 * request. Whether the block is in the tree is the shell's to check: it drops a scope it cannot
 * find, the same way it drops one whose block is deleted later.
 */
export function focus( clientId: unknown, options?: unknown ): boolean {
	if ( ! getSession()?.mount ) {
		console.error( 'blicks: studio.focus() needs an open Studio with something mounted.' );
		return false;
	}

	const next = focusScope( clientId, options, __( 'Back', 'blicks' ) );

	if ( ! next ) {
		return false;
	}

	set( next );

	return true;
}

/** Leave the scope. `studio.unfocus()` on the published API; harmless with none set. */
export function unfocus(): void {
	set( null );
}

export function subscribe( listener: Listener ): () => void {
	listeners.add( listener );

	return () => {
		listeners.delete( listener );
	};
}

export function useFocus(): FocusScope | null {
	const [ current, setCurrent ] = useState< FocusScope | null >( () => getFocus() );

	useEffect( () => subscribe( setCurrent ), [] );

	return current;
}

/*
 * A scope is about one mount. Anything that replaces or closes it — a new mount, the library,
 * closing — takes the scope with it.
 */
let mounted: Mount | null = getSession()?.mount ?? null;

subscribeSession( ( session ) => {
	const next = session?.mount ?? null;

	if ( next !== mounted ) {
		mounted = next;
		set( null );
	}
} );
