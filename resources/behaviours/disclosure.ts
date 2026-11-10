/**
 * The `disclosure` behaviour: the `blicks/disclosure` Interactivity store. See ./disclosure-core.ts
 * for what it does. A block opts in with directives on the region and its toggle:
 *
 *   <li data-wp-interactive="blicks/disclosure"
 *       data-wp-on--keydown="actions.key"            Esc
 *       data-wp-on-document--keydown="actions.escape" Esc with focus elsewhere
 *       data-wp-on--focusout="actions.focusout"      focus left the region
 *       data-wp-on-document--click="actions.outside" a click anywhere else
 *       data-wp-on--bl-intent="actions.intent">      the hover-intent behaviour
 *     <button aria-expanded="false" aria-controls="panel-1" data-wp-on--click="actions.toggle">…</button>
 *     <div id="panel-1">…</div>
 *   </li>
 *
 * Optional: `data-wp-on-window--scroll="actions.scroll"` with `data-bl-close-on-scroll` on the
 * region, and `data-wp-on--click="actions.close"` on any button inside it (a Back button).
 *
 * A companion opens or closes one with `store( 'blicks/disclosure' ).actions.open( element )`.
 */
import { getElement, store, withSyncEvent } from '@wordpress/interactivity';
import * as core from './disclosure-core';

const region = (): HTMLElement | null => core.regionOf( getElement().ref );

const on = < E extends Event >( fn: ( region: HTMLElement, e: E ) => void ) => ( e: E ) => {
	const el = region();
	if ( el ) fn( el, e );
};

store( 'blicks/disclosure', {
	actions: {
		open( el: Element ) {
			const r = core.regionOf( el );
			if ( r ) core.open( r, 'api' );
		},
		toggle: on( ( r ) => core.toggled( r ) ),
		close: on( ( r ) => {
			core.close( r, 'button' );
			core.toggleOf( r )?.focus();
		} ),
		// Cancels the key, so it must run in the event.
		key: withSyncEvent( on( core.keyed ) ),
		escape: on( core.escaped ),
		focusout: on( core.focusedOut ),
		outside: on( core.clickedOutside ),
		intent: on( core.intended ),
		scroll: on( ( r ) => core.scrolled( r ) ),
	},
} );
