/**
 * `@blicks-pro/dialog-auto`: opens a saved dialog by itself, when its triggers fire and its
 * visitor rules allow (`auto-core.ts`); and, for every saved dialog on the page however it opened,
 * remembers closes and conversions in the visitor's browser and sends the daily counts. Enqueued
 * only on pages the server printed a saved dialog on (`Printer`).
 *
 * It opens through the free `dialog` behaviour's public store, so focus, scroll lock, the close
 * button and the `bl:dialog-*` events are the behaviour's, not a second copy here.
 */
import { store } from '@wordpress/interactivity';
import * as core from './auto-core';

type Opener = ( id: string, options: { source: 'auto' } ) => void;

const safe = < T >( get: () => T ): T | null => {
	try {
		return get();
	} catch {
		return null;
	}
};

const local = safe( () => window.localStorage );
const session = safe( () => window.sessionStorage );

/** The automatic dialogs on the page this visitor may see, in page order. */
export function eligible( root: ParentNode, visitor: Omit< core.Visitor, 'memory' | 'seenThisVisit' > ): { dialog: HTMLDialogElement; config: core.AutoConfig }[] {
	const out: { dialog: HTMLDialogElement; config: core.AutoConfig }[] = [];

	for ( const dialog of root.querySelectorAll< HTMLDialogElement >( 'dialog[data-bl-auto]' ) ) {
		const config = core.readConfig( dialog.getAttribute( 'data-bl-auto' ) );

		if ( config && '' === core.refusal( config, { ...visitor, memory: core.recall( local, config.id ), seenThisVisit: !! core.recall( session, config.id ).shown } ) ) {
			out.push( { dialog, config } );
		}
	}

	return out;
}

/** Watch every eligible dialog's triggers; the first to fire opens its dialog and stops the rest. */
export function arm( found: { dialog: HTMLDialogElement; config: core.AutoConfig }[], open: Opener ): () => void {
	const stops: ( () => void )[] = [];
	let done = false;
	const stop = (): void => stops.splice( 0 ).forEach( ( s ) => s() );

	const fire = ( dialog: HTMLDialogElement, config: core.AutoConfig ) => (): void => {
		// One per page view; and never over a dialog the visitor opened themselves.
		if ( done || document.querySelector( 'dialog.bl-dialog[open]' ) ) return;
		done = true;
		stop();
		const now = Date.now();
		core.remember( local, config.id, 'shown', now );
		core.remember( session, config.id, 'shown', now );
		open( dialog.id, { source: 'auto' } );
	};

	const listen = < K extends keyof WindowEventMap >( target: Window | Document, type: K, fn: ( e: WindowEventMap[ K ] ) => void ): void => {
		target.addEventListener( type, fn as EventListener, { passive: true } );
		stops.push( () => target.removeEventListener( type, fn as EventListener ) );
	};

	for ( const { dialog, config } of found ) {
		const go = fire( dialog, config );
		const t = config.triggers;

		if ( t.load.on ) {
			const timer = window.setTimeout( go, t.load.delay * 1000 );
			stops.push( () => window.clearTimeout( timer ) );
		}

		if ( t.scroll.on ) {
			listen( window, 'scroll', () => {
				if ( core.scrolledPast( t.scroll.percent, window.scrollY, window.innerHeight, document.documentElement.scrollHeight ) ) go();
			} );
		}

		if ( t.exit.on ) {
			listen( document, 'mouseout', ( e ) => core.leftThroughTop( e ) && go() );
			const samples: [ number, number ][] = [];
			listen( window, 'scroll', () => {
				const now = performance.now();
				samples.push( [ now, window.scrollY ] );
				if ( samples.length > 20 ) samples.shift();
				if ( core.screenOf( window.innerWidth ) !== 'desktop' && core.flungUp( samples, now ) ) go();
			} );
		}

		if ( t.idle.on ) {
			let timer = window.setTimeout( go, t.idle.seconds * 1000 );
			const reset = (): void => {
				window.clearTimeout( timer );
				timer = window.setTimeout( go, t.idle.seconds * 1000 );
			};
			for ( const type of [ 'pointermove', 'keydown', 'scroll', 'touchstart' ] as const ) listen( window, type, reset );
			stops.push( () => window.clearTimeout( timer ) );
		}
	}

	return stop;
}

/** Send one count, `shown` or `converted`, without holding up the page or a link being followed. */
export type Send = ( id: number, event: 'shown' | 'converted' ) => void;

export function beacon( base: string ): Send {
	return ( id, event ) => {
		if ( ! base || ! navigator.sendBeacon ) return;
		try {
			navigator.sendBeacon( `${ base }${ id }/events`, new URLSearchParams( { event } ) );
		} catch {}
	};
}

/** Where to send counts: the module's script data (`Module::autoData()`), or nowhere. */
export function eventsUrl( root: Document ): string {
	try {
		const data = JSON.parse( root.getElementById( 'wp-script-module-data-@blicks-pro/dialog-auto' )?.textContent ?? '{}' ) as { events?: unknown };
		return 'string' === typeof data.events ? data.events : '';
	} catch {
		return '';
	}
}

/**
 * Every saved dialog on the page, however it was opened: count it shown, remember it closed, and
 * count and remember a conversion, once per opening.
 */
export function track( root: Document, send: Send ): void {
	const idOf = ( el: EventTarget | null ): number => Number( ( el as Element | null )?.closest?.( 'dialog[data-bl-saved]' )?.getAttribute( 'data-bl-saved' ) ?? 0 );
	const converted = new Set< number >();

	root.addEventListener( 'bl:dialog-open', ( e ) => {
		const id = idOf( e.target );
		if ( ! id ) return;
		converted.delete( id );
		send( id, 'shown' );
	} );

	root.addEventListener( 'bl:dialog-close', ( e ) => {
		const id = idOf( e.target );
		if ( id ) core.remember( local, id, 'closed', Date.now() );
	} );

	for ( const type of [ 'submit', 'click' ] ) {
		root.addEventListener(
			type,
			( e ) => {
				const id = idOf( e.target );
				if ( ! id || converted.has( id ) || ! core.converts( e.target, type ) ) return;
				converted.add( id );
				core.remember( local, id, 'converted', Date.now() );
				send( id, 'converted' );
			},
			true
		);
	}
}

/* ------------------------------------------------------------------ on the page */

if ( 'undefined' !== typeof document ) {
	const start = (): void => {
		track( document, beacon( eventsUrl( document ) ) );
		arm(
			eligible( document, { loggedIn: document.body.classList.contains( 'logged-in' ), width: window.innerWidth, now: Date.now() } ),
			( id, options ) => ( store( 'blicks/dialog' ) as unknown as { actions: { open: Opener } } ).actions.open( id, options )
		);
	};

	if ( 'loading' === document.readyState ) document.addEventListener( 'DOMContentLoaded', start, { once: true } );
	else start();
}
