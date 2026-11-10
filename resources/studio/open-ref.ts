/**
 * `studio.openRef( modeId, ref )`: open the Studio on a stored tree rather than a post block.
 *
 * The ways in that are not the post editor's toolbar call this: the Site Editor's "Edit in Header
 * Studio" on a template part, a Dialogs list's Edit on a saved dialog. The mode that stores the tree
 * loads it (`StudioMode.persist.load`), and the Studio mounts the copy with the ref attached, so
 * its filled door saves back to the same place.
 *
 * Refused with a console error, never thrown, like every other call on the published API. A load
 * that fails is reported the same way: the caller is a button in someone else's screen, and the
 * one thing it must not do is take that screen down.
 */

import { modes, type StudioRef } from './registry';
import { mountRef } from './mount';
import { getSession, openSession } from './session';

const isRef = ( value: unknown ): value is StudioRef =>
	!! value && 'object' === typeof value && ! Array.isArray( value );

/** Why `openRef` cannot run for this mode and ref, or ''. */
export function openRefProblem( modeId: unknown, ref: unknown ): string {
	const mode = modes.list().find( ( m ) => m.id === modeId );

	if ( ! mode ) {
		return `a registered mode (no mode "${ String( modeId ) }")`;
	}

	if ( ! mode.persist ) {
		return `a mode that persists ("${ mode.id }" has no persist)`;
	}

	if ( ! isRef( ref ) ) {
		return 'a ref object';
	}

	if ( getSession()?.mount ) {
		return 'the Studio to be closed or on the library (something is already mounted)';
	}

	return '';
}

/**
 * Resolves true once the Studio is open on the stored tree, false when it was refused or the load
 * failed. The ref is copied, so a caller changing its object afterwards changes nothing here.
 */
export async function openRef( modeId: unknown, ref: unknown ): Promise< boolean > {
	const problem = openRefProblem( modeId, ref );

	if ( problem ) {
		console.error( `blicks: studio.openRef() needs ${ problem }.`, modeId, ref );
		return false;
	}

	const mode = modes.list().find( ( m ) => m.id === modeId )!;
	const stored = JSON.parse( JSON.stringify( ref ) ) as StudioRef;

	try {
		const loaded = await mode.persist!.load( stored );

		if ( ! loaded || ! Array.isArray( loaded.blocks ) ) {
			console.error( `blicks: the Studio mode "${ mode.id }" loaded no blocks.`, ref );
			return false;
		}

		// Checked again: the load is asynchronous, and the author may have opened something else.
		if ( getSession()?.mount ) {
			console.error( 'blicks: studio.openRef() found something mounted when the load finished.' );
			return false;
		}

		const label = 'string' === typeof loaded.label && '' !== loaded.label.trim() ? loaded.label.trim() : mode.label;
		const note = 'string' === typeof loaded.note ? loaded.note.trim() : '';

		openSession( mountRef( loaded.blocks, mode.id, stored, label, note ) );

		return true;
	} catch ( failure ) {
		console.error( `blicks: the Studio mode "${ mode.id }" could not load its tree.`, failure );
		return false;
	}
}
