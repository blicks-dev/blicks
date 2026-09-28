import { useEffect, useState } from '@wordpress/element';

/**
 * Which Scene is currently open in the full-screen editor.
 *
 * This is view state, not content: it must never reach saved markup, so it cannot be a block
 * attribute. It also has to be readable from two places that do not share a React tree — the
 * block toolbar (which opens the editor) and the block's own render (which draws it) — so a
 * `useState` inside either one is not enough.
 *
 * A module-level value with subscribers is the smallest thing that satisfies both. Only one Scene
 * can be open at a time, which is why this is a single id rather than a set.
 */

let openClientId: string | null = null;
const listeners = new Set< () => void >();

function notify(): void {
	for ( const listener of listeners ) listener();
}

export function setSceneEditorOpen( clientId: string, open: boolean ): void {
	const next = open ? clientId : null;
	if ( openClientId === next ) return;
	// Opening a second Scene closes the first — two full-screen surfaces cannot coexist.
	if ( ! open && openClientId !== clientId ) return;
	openClientId = next;
	notify();
}

export function useSceneEditorOpen( clientId?: string ): boolean {
	const [ , force ] = useState( 0 );

	useEffect( () => {
		const listener = () => force( ( n ) => n + 1 );
		listeners.add( listener );
		return () => {
			listeners.delete( listener );
		};
	}, [] );

	return !! clientId && openClientId === clientId;
}
