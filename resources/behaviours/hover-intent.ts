/**
 * The `hover-intent` behaviour: the `blicks/hover-intent` Interactivity store. See
 * ./hover-intent-core.ts. It is used from inside another behaviour's region, by namespace:
 *
 *   data-wp-on--pointerenter="blicks/hover-intent::actions.enter"
 *   data-wp-on--pointerleave="blicks/hover-intent::actions.leave"
 *   data-bl-delay="150"
 *
 * and the element then receives `bl-intent` events. A reference like that is enough for the
 * behaviour to load on the page (Blicks\Behaviours\Behaviours::used()).
 */
import { getElement, store } from '@wordpress/interactivity';
import * as core from './hover-intent-core';

store( 'blicks/hover-intent', {
	actions: {
		enter( e: PointerEvent ) {
			const el = getElement().ref;
			if ( el ) core.entered( el, e );
		},
		leave( e: PointerEvent ) {
			const el = getElement().ref;
			if ( el ) core.left( el, e );
		},
	},
} );
