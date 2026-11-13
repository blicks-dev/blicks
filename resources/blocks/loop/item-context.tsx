/**
 * The item of the Loop card a block sits in, for a Loop inside that card ("A list of the item
 * above", the `item` source; src/Data/ItemSource.php on the page).
 *
 * Two ways to reach it, because the editor draws a card twice over:
 *
 * - **React context.** Every Loop wraps its live card and each preview card in a provider holding
 *   that card's item. A Loop inside reads the nearest one, so a preview copy (drawn by core's block
 *   preview, in a store of its own where the outer Loop cannot be found) still gets its own card's
 *   item, at any depth.
 * - **A small store by Loop clientId.** A block bound inside that inner Loop, or the inner Loop's
 *   own settings and card shelf, need its items too but sit outside the provider's reach in the
 *   inspector: the inner Loop records the item it was given here.
 */
import { createContext, useEffect, useSyncExternalStore } from 'react';
import type { Item } from './data';

/** `undefined`: not inside any Loop card. */
export const LoopItemContext = createContext< Item | undefined >( undefined );

const parents = new Map< string, Item | undefined >();
const listeners = new Set< () => void >();

/** Record the card item a Loop sits in (from the canvas), for its settings and bound blocks. */
export function useRecordParentItem( clientId: string, item: Item | undefined ): void {
	useEffect( () => {
		if ( parents.get( clientId ) === item ) return;
		parents.set( clientId, item );
		listeners.forEach( ( l ) => l() );
	}, [ clientId, item ] );
}

/** The card item the Loop `clientId` sits in, as its canvas last recorded it. */
export function useParentItem( clientId: string | undefined ): Item | undefined {
	return useSyncExternalStore(
		( l ) => {
			listeners.add( l );
			return () => listeners.delete( l );
		},
		() => ( clientId ? parents.get( clientId ) : undefined )
	);
}
