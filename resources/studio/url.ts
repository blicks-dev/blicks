/**
 * The Studio in the editor's address, so a reload opens it again.
 *
 * `?blicks-studio=<uniqueId>` names the post block the Studio was opened on; `library` means the
 * library was up; `ref:<mode>:<json>` names a stored tree a mode opened (`studio.openRef()`), which
 * is also how a screen without the Studio links to one. A client id would not do: the editor gives every block a new one on each load,
 * while `uniqueId` is saved with the block (`define-block.tsx`).
 *
 * A reload reopens on the block as the post has it, not on the Studio's unsaved copy. A tree with
 * no block in the post behind it (a blank section, a pattern from the library) writes nothing, as
 * there is nothing to reopen.
 */

import type { BlockNode } from './mount';
import type { Session } from './session';
import type { StudioRef } from './registry';

export const STUDIO_PARAM = 'blicks-studio';

export const LIBRARY = 'library';

const REF = 'ref:';

/** The parameter for a stored tree: `ref:<mode>:<ref as JSON>`. */
export function refParam( mode: string, ref: StudioRef ): string {
	return `${ REF }${ mode }:${ JSON.stringify( ref ) }`;
}

/** A `ref:` parameter read back, or null when it is not one or does not parse to a mode and an object. */
export function readRefParam( value: string | null ): { mode: string; ref: StudioRef } | null {
	if ( ! value || ! value.startsWith( REF ) ) {
		return null;
	}

	const rest = value.slice( REF.length );
	const colon = rest.indexOf( ':' );

	if ( colon < 1 ) {
		return null;
	}

	try {
		const ref = JSON.parse( rest.slice( colon + 1 ) ) as unknown;

		return ref && 'object' === typeof ref && ! Array.isArray( ref ) ? { mode: rest.slice( 0, colon ), ref: ref as StudioRef } : null;
	} catch {
		return null;
	}
}

/** What a session puts in the address: `null` to take the parameter out. */
export function studioParam( session: Session | null, originUniqueId: string | null ): string | null {
	if ( ! session ) {
		return null;
	}

	if ( ! session.mount ) {
		return LIBRARY;
	}

	if ( session.mount.ref ) {
		return refParam( session.mount.mode, session.mount.ref );
	}

	return originUniqueId || null;
}

/** `href` with the parameter set to `value`, or removed for `null`; every other part kept. */
export function withStudioParam( href: string, value: string | null ): string {
	const url = new URL( href );

	if ( null === value ) {
		url.searchParams.delete( STUDIO_PARAM );
	} else {
		url.searchParams.set( STUDIO_PARAM, value );
	}

	return url.toString();
}

/** The parameter in `search`, or `null` when it is absent or empty. */
export function readStudioParam( search: string ): string | null {
	return new URLSearchParams( search ).get( STUDIO_PARAM ) || null;
}

/**
 * Keep the parameter through the editor's own address writes.
 *
 * `edit-post`'s `BrowserURL` replaces the address with a bare `post.php?post=…&action=edit` as the
 * editor loads, and again when the post's status or revision changes — so a parameter written
 * once was gone by the next reload. Each `replaceState` with a URL now carries whatever `current`
 * says. `pushState` is left alone: that is the editor moving to another post, where the parameter
 * does not belong.
 */
export function keepStudioParam( history: History, current: () => string | null ): void {
	const replace = history.replaceState.bind( history );

	history.replaceState = ( data: unknown, unused: string, url?: string | URL | null ): void => {
		const value = current();

		replace( data, unused, null === value || null === url || undefined === url ? url : withStudioParam( new URL( String( url ), window.location.href ).toString(), value ) );
	};
}

/** The block in `blocks`, at any depth, whose `uniqueId` is `id`. */
export function findByUniqueId( blocks: BlockNode[], id: string ): BlockNode | null {
	for ( const block of blocks ) {
		if ( ( block.attributes as Record< string, unknown > | undefined )?.uniqueId === id ) {
			return block;
		}

		const inner = findByUniqueId( block.innerBlocks ?? [], id );

		if ( inner ) {
			return inner;
		}
	}

	return null;
}
