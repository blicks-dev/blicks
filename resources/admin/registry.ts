import type { ExternalViewDefinition, RegisteredView } from './types';

/**
 * The runtime registry companion plugins render through.
 *
 * Registration is split across two plugins on purpose. PHP owns *whether a page exists* — the
 * submenu, the capability, the slug, and the fact that `blicks-admin` gets enqueued on that
 * screen at all, none of which JavaScript can arrange. This file owns *what the page looks like*.
 * A page registered only here is ignored: without the PHP half there is no capability check, and
 * rendering it would be a privilege hole.
 *
 * The store is observable rather than read-once because of load order. `app.tsx` mounts when its
 * module evaluates, and a companion script that declares `blicks-admin` as a dependency runs
 * strictly *after* that — so every registration would arrive after the first render. Deferring the
 * mount fixes the common case but not a view registered from an async chunk or a plugin that loads
 * late, which is the kind of race that passes locally and fails on a slow connection.
 */

const views = new Map< string, RegisteredView >();
const listeners = new Set< () => void >();

// `useSyncExternalStore` compares snapshots by identity, so the same array must come back until
// something actually changes. Rebuilding it on every call would re-render forever.
let snapshot: RegisteredView[] = [];

function publish(): void {
	snapshot = Array.from( views.values() );
	listeners.forEach( listener => listener() );
}

function isUsable( definition: unknown ): definition is ExternalViewDefinition {
	if ( typeof definition !== 'object' || definition === null ) return false;

	const { id, render } = definition as Partial< ExternalViewDefinition >;

	return typeof id === 'string' && id.trim() !== '' && typeof render === 'function';
}

/**
 * Register the component for a page this plugin does not own.
 *
 * Returns `false` when the definition is unusable, rather than throwing: this runs inside another
 * plugin's bundle, and an exception here would take the whole admin app down with it — the page
 * that fails to register should be the only casualty.
 */
export function registerView( definition: unknown ): boolean {
	if ( ! isUsable( definition ) ) {
		// eslint-disable-next-line no-console
		console.error( 'blicks: registerView() needs an { id, render } object.', definition );
		return false;
	}

	views.set( definition.id, {
		id: definition.id,
		render: definition.render,
		icon: definition.icon,
	} );

	publish();

	return true;
}

export function unregisterView( id: string ): void {
	if ( views.delete( id ) ) {
		publish();
	}
}

export function getRegisteredViews(): RegisteredView[] {
	return snapshot;
}

export function getRegisteredView( id: string ): RegisteredView | undefined {
	return views.get( id );
}

export function subscribeToViews( listener: () => void ): () => void {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

/** Test seam. Not exposed on `window`. */
export function resetViews(): void {
	views.clear();
	publish();
}

/**
 * The public surface, on `window` so a separately-bundled plugin can reach it without importing
 * anything from this build.
 */
export function exposeRegistry(): void {
	const globalScope = window as unknown as { blicks?: { admin?: Record< string, unknown > } };

	globalScope.blicks = globalScope.blicks ?? {};
	globalScope.blicks.admin = {
		...( globalScope.blicks.admin ?? {} ),
		registerView,
		unregisterView,
	};
}
