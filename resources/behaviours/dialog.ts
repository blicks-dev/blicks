/**
 * The `dialog` behaviour: the `blicks/dialog` Interactivity store.
 *
 * Every rendered Dialog block is its own interactive region. The directives are written on the
 * `<dialog>` when the page renders (Blicks\Blocks\Dialogs), not saved, so they can change without
 * a migration:
 *
 *   data-wp-interactive="blicks/dialog"
 *   data-wp-init="callbacks.init"                 a page loaded at #dialog-<address>
 *   data-wp-on-window--hashchange="callbacks.address"
 *   data-wp-on-window--popstate="callbacks.moved"   Back and Forward over a Loop's ?item=
 *   data-wp-on-document--click="actions.click"    openers anywhere on the page
 *   data-wp-on-document--keydown="actions.key"    Esc for a non-modal dialog
 *   data-wp-on--pointerdown="actions.press"       a press on the backdrop
 *   data-wp-on--command="actions.command"         native invoker commands
 *   data-wp-on--cancel="actions.cancel"           Esc on a modal
 *   data-wp-on--close="actions.closed"            however it closed
 *
 * A companion opens one from its own module with
 * `store( 'blicks/dialog' ).actions.open( 'dialog-newsletter', { source: 'auto' } )`.
 */
import { getElement, store, withSyncEvent } from '@wordpress/interactivity';
import * as core from './dialog-core';

const self = (): HTMLDialogElement | null => {
	const ref = getElement().ref;
	return core.isBlicksDialog( ref ) ? ref : null;
};

const on = < E extends Event >( fn: ( dialog: HTMLDialogElement, e: E ) => void ) => ( e: E ) => {
	const dialog = self();
	if ( dialog ) fn( dialog, e );
};

store( 'blicks/dialog', {
	actions: {
		open( id: string, options?: core.OpenOptions ) {
			const dialog = core.find( id );
			if ( dialog ) core.open( dialog, { source: 'api', ...options } );
		},
		close( id: string ) {
			const dialog = core.find( id );
			if ( dialog ) core.close( dialog, 'api' );
		},
		// These may cancel the browser's default (follow a link, open a modal), so they run in
		// the event, not after it.
		click: withSyncEvent( on( core.clicked ) ),
		command: withSyncEvent( on( core.command ) ),
		key: on( core.keyed ),
		press: on( core.pressed ),
		cancel: on( ( dialog ) => core.cancelled( dialog ) ),
		closed: on( ( dialog ) => core.closed( dialog ) ),
	},
	callbacks: {
		init: on( ( dialog ) => core.addressed( dialog ) ),
		address: on( ( dialog ) => core.addressed( dialog ) ),
		moved: on( ( dialog ) => core.moved( dialog ) ),
	},
} );
