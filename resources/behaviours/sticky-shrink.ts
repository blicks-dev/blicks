/**
 * The `sticky-shrink` behaviour: the `blicks/sticky-shrink` Interactivity store. See
 * ./sticky-shrink-core.ts. A block opts in on its element:
 *
 *   data-wp-interactive="blicks/sticky-shrink"
 *   data-wp-init="callbacks.init"
 *   data-wp-on-window--scroll="callbacks.scroll"
 *   data-bl-after="8"
 *
 * and to hide while the page scrolls down, also:
 *
 *   data-bl-hide
 *   data-wp-on--focusin="callbacks.focus"
 */
import { getElement, store } from '@wordpress/interactivity';
import * as core from './sticky-shrink-core';

store( 'blicks/sticky-shrink', {
	callbacks: {
		init() {
			const el = getElement().ref;
			if ( el ) core.update( el, window.scrollY );
		},
		scroll() {
			const el = getElement().ref;
			if ( el ) core.scrolled( el );
		},
		focus() {
			const el = getElement().ref;
			if ( el ) core.focused( el );
		},
	},
} );
