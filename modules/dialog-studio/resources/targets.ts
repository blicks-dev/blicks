/**
 * Saved dialogs in the Button's dialog picker, through the free `blicks.dialog.targets` filter.
 *
 * The list is printed with the editor (`Module::editorData()`), so the picker is filled the moment
 * it opens, with no request; a dialog created in this session is added as it is created.
 */
import type { DialogTarget } from './host';
import { editorData } from './host';

const created: DialogTarget[] = [];

export function rememberTarget( target: DialogTarget ): void {
	created.push( target );
}

/** The page's own dialogs first; then saved ones, except any the page already holds by that id. */
export function withSaved( page: unknown, saved: DialogTarget[] = [ ...editorData().targets, ...created ] ): DialogTarget[] {
	const list = Array.isArray( page ) ? ( page as DialogTarget[] ) : [];
	const ids = new Set( list.map( ( t ) => t.id ) );
	const out = [ ...list ];

	for ( const t of saved ) {
		if ( ! ids.has( t.id ) ) {
			ids.add( t.id );
			out.push( t );
		}
	}

	return out;
}
