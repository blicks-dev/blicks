/**
 * When a conditional inspector section is allowed to show.
 *
 * A `SECTIONS` entry may carry a `context` — `grid-parent`, `flex-parent`, `scene-parent` — and the
 * section only appears when that context is met. The three predicates used to be hooks in
 * `Inspector.tsx`, which meant the framework named the blocks they test for.
 *
 * That is fine for grid and flex: both fall back to a `display` value, so any container can opt in
 * and the block name is only a shortcut. It is wrong for a context whose whole test IS a block
 * name, because the framework then hardcodes a block it may not ship. `scene-parent` is exactly
 * that, and `blicks/scene` is moving to a companion plugin.
 *
 * So the predicates live in a registry. The framework pre-registers the two generic ones; a
 * name-based context is registered by whoever owns the block, and travels with it.
 *
 * **An unregistered context is never met.** A section declaring one therefore stays hidden rather
 * than appearing broken — which is the behaviour that makes a section in this plugin inert while
 * the plugin supplying its context is inactive.
 */

/** Given a block, is this context satisfied? `select` is bound to the ambient registry. */
export type ContextPredicate = ( clientId: string, select: ( store: string ) => any ) => boolean;

const predicates = new Map< string, ContextPredicate >();

/**
 * Teach the inspector about a context.
 *
 * Re-registering an id replaces it, deliberately: a plugin reloading its editor bundle should not
 * have to care whether it ran before.
 *
 * Returns `false` rather than throwing on a bad argument. This is reachable from another plugin's
 * bundle, where an exception would take the whole editor down — the context that fails to register
 * should be the only casualty, and a section that needs it simply stays hidden.
 */
export function registerContext( id: unknown, predicate: unknown ): boolean {
	if ( typeof id !== 'string' || id.trim() === '' || typeof predicate !== 'function' ) {
		// eslint-disable-next-line no-console
		console.error( 'blicks: registerContext() needs an id and a predicate.', id );
		return false;
	}

	predicates.set( id, predicate as ContextPredicate );

	return true;
}

/** Drop one. Mainly a test seam; a plugin deactivating mid-session is not a case worth serving. */
export function unregisterContext( id: string ): void {
	predicates.delete( id );
}

/** Every registered id. For tests and for the drift check on the published surface. */
export function registeredContexts(): string[] {
	return Array.from( predicates.keys() );
}

/**
 * Resolve every context for one block.
 *
 * Returns a flat object of primitives on purpose: `useSelect` shallow-compares what its callback
 * returns, so a fresh object of the same booleans does not re-render. An object of objects would.
 */
export function resolveContexts(
	clientId: string | undefined,
	select: ( store: string ) => any
): Record< string, boolean > {
	const met: Record< string, boolean > = {};

	for ( const [ id, predicate ] of predicates ) {
		if ( ! clientId ) {
			met[ id ] = false;
			continue;
		}

		try {
			met[ id ] = Boolean( predicate( clientId, select ) );
		} catch {
			// A companion's predicate must not be able to blank the inspector.
			met[ id ] = false;
		}
	}

	return met;
}

/** `layout.display` set to one of these, at any breakpoint of the default state. */
export function hasDisplayValue( attributes: any, values: readonly string[] ): boolean {
	const display = attributes?.blicks?.[ 'layout.display' ];
	if ( ! display || typeof display !== 'object' ) return false;
	const byBreakpoint = display.default;
	if ( ! byBreakpoint || typeof byBreakpoint !== 'object' ) return false;
	return Object.values( byBreakpoint ).some( ( v ) => values.includes( v as string ) );
}

/** A direct parent that declares one of these `display` values. */
function parentDisplays( displays: readonly string[] ): ContextPredicate {
	return ( clientId, select ) => {
		const store = select( 'core/block-editor' );
		const parentId = store?.getBlockRootClientId?.( clientId );
		if ( ! parentId ) return false;
		return hasDisplayValue( store?.getBlockAttributes?.( parentId ), displays );
	};
}

/**
 * An ANCESTOR of this name, at any depth.
 *
 * Exported because it is the shape a companion registering a name-based context almost always
 * wants, and re-implementing a parent walk per plugin is how they drift.
 */
export function hasAncestorOfName( name: string ): ContextPredicate {
	return ( clientId, select ) => {
		const store = select( 'core/block-editor' );
		let cur = store?.getBlockRootClientId?.( clientId );

		while ( cur ) {
			if ( store?.getBlockName?.( cur ) === name ) return true;
			cur = store?.getBlockRootClientId?.( cur );
		}

		return false;
	};
}

// The generic two. Both read the parent's `display`, so they are about layout rather than about a
// particular block, and they belong to the framework.
registerContext( 'grid-parent', parentDisplays( [ 'grid', 'inline-grid' ] ) );
registerContext( 'flex-parent', parentDisplays( [ 'flex', 'inline-flex' ] ) );
