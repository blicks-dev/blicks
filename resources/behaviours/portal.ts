/**
 * The `portal` behaviour: the `blicks/portal` Interactivity store. See ./portal-core.ts. On the
 * element that moves:
 *
 *   data-wp-interactive="blicks/portal"
 *   data-wp-init="callbacks.init"
 *   data-bl-portal="dialog-nav-1a2b3c4d"
 *
 * It moves the element's own DOM node and reads no reactive state, so nothing re-renders it.
 */
import { getElement, store } from '@wordpress/interactivity';
import { follow } from './portal-core';

store( 'blicks/portal', {
	callbacks: {
		init() {
			const el = getElement().ref;
			return el ? follow( el ) : undefined;
		},
	},
} );
