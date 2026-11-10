/**
 * The `form` behaviour: the `blicks/form` Interactivity store.
 *
 * The directives are written on the `<form>` when the page renders (Blicks\Forms\FormRenderer),
 * not saved, so they can change without a migration:
 *
 *   data-wp-interactive="blicks/form"
 *   data-wp-context='{ form, post, token, entries, nonce, after, challenge, i18n, minSeconds }'
 *   data-wp-on--submit="actions.submit"      validate, then send with fetch
 *   data-wp-on--focusin="actions.prime"      fetch the send token on first focus
 *   data-wp-on--input="actions.edited"       re-check a field that shows an error; blicks:form-input
 *   data-wp-on--focusout="actions.left"      check a field on leaving it, after a send was tried
 *   data-wp-on--click="actions.click"        stepper buttons
 *   data-wp-on--reset="actions.reset"        clear errors, then re-sync outputs and counts
 *   data-wp-init="callbacks.init"            hidden fields from the address, range outputs and
 *                                            counts, challenge widgets
 *
 * The logic is ./form-core.ts, plain DOM functions; this only reads the directive's element and
 * context and hands them over.
 */
import { getContext, getElement, store, withSyncEvent } from '@wordpress/interactivity';
import * as core from './form-core';

const self = (): HTMLFormElement | null => {
	const ref = getElement().ref;
	return ref instanceof HTMLFormElement ? ref : null;
};

/** A plain copy of the context: the send runs on after the directive's scope has gone. */
const context = (): core.FormContext => JSON.parse( JSON.stringify( getContext< core.FormContext >() ) );

const deps: core.Deps = {
	fetch: ( ...args ) => window.fetch( ...args ),
	now: () => Date.now(),
	wait: ( ms ) => new Promise( ( done ) => setTimeout( done, ms ) ),
	assign: ( url ) => window.location.assign( url ),
	openDialog( id ) {
		if ( ! document.getElementById( id ) ) return false;
		const open = ( store( 'blicks/dialog' ) as any )?.actions?.open;
		if ( typeof open !== 'function' ) return false;
		open( id );
		return true;
	},
	win: window,
};

store( 'blicks/form', {
	actions: {
		submit: withSyncEvent( ( e: SubmitEvent ) => {
			e.preventDefault();
			const form = self();
			if ( form ) void core.submit( form, context(), deps );
		} ),
		prime() {
			const form = self();
			if ( form ) core.ensureToken( form, context(), deps ).catch( () => {} );
		},
		edited( e: Event ) {
			const form = self();
			const field = form && core.fieldOf( form, e.target );
			if ( ! form || ! field ) return;
			core.syncField( field );
			if ( core.showsError( field ) ) core.check( field );
			core.announceInput( form, field );
		},
		click( e: MouseEvent ) {
			const form = self();
			if ( form ) core.step( form, e.target );
		},
		reset() {
			const form = self();
			if ( form ) core.reset( form );
		},
		left( e: FocusEvent ) {
			const form = self();
			if ( ! form || ! core.attempted( form ) ) return;
			const field = core.fieldOf( form, e.target );
			// Moving between a choice's boxes is not leaving it.
			if ( field && ! ( e.relatedTarget instanceof Node && field.contains( e.relatedTarget ) ) ) core.check( field );
		},
	},
	callbacks: {
		init() {
			const form = self();
			if ( ! form ) return;
			const ctx = context();
			core.fill( form, { search: window.location.search, referrer: document.referrer } );
			core.sync( form );
			return core.watchChallenge( form, ctx, window );
		},
	},
} );
