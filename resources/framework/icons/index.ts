/**
 * Extensible icon registry.
 *
 * - Curated Lucide set registers itself via `./lucide.gen` (built by `pnpm gen:icons`).
 * - External plugins / premium packs can call `registerIconLibrary( ... )` (also exposed
 *   on `window.blicks.icons.register` for non-bundled extension points).
 * - Lookups go through `getIcon( name )`, which honours back-compat aliases for the legacy
 *   12-icon set (e.g. `arrowRight` → `arrow-right`, `bolt` → `zap`).
 *
 * `renderIcon` returns a stable, framework-agnostic SVG element — the same shape Gutenberg
 * saved in the previous registry, so existing block markup keeps validating.
 */

export interface IconDef {
	label: string;
	/** Raw SVG inner markup (paths/lines/etc.) extracted at build time. No outer <svg>. */
	svg: string;
	category?: string;
	keywords?: string[];
}

export interface IconLibrary {
	id: string;
	label: string;
	/** Higher priority wins on name collisions. */
	priority: number;
	icons: Record< string, IconDef >;
}

const LIBRARIES = new Map< string, IconLibrary >();
const ALIASES: Record< string, string > = Object.create( null );

/** Default fallback when a name resolves to nothing. */
const FALLBACK_NAME = 'star';

export function registerIconLibrary( lib: IconLibrary ): void {
	LIBRARIES.set( lib.id, lib );
}

export function registerIconAlias( alias: string, target: string ): void {
	ALIASES[ alias ] = target;
}

export function registerIconAliases( aliases: Record< string, string > ): void {
	for ( const [ alias, target ] of Object.entries( aliases ) ) {
		ALIASES[ alias ] = target;
	}
}

/** Resolve a name to its canonical (post-alias) form without checking existence. */
export function resolveIconName( name: unknown ): string {
	const raw = String( name ?? '' );
	return ALIASES[ raw ] ?? raw;
}

/** Look up an icon definition, honouring aliases + library priority. Returns null when missing. */
export function getIcon( name: unknown ): IconDef | null {
	const key = resolveIconName( name );
	if ( ! key ) return null;
	let hit: IconDef | null = null;
	let bestPriority = -Infinity;
	for ( const lib of LIBRARIES.values() ) {
		const def = lib.icons[ key ];
		if ( def && lib.priority > bestPriority ) {
			hit = def;
			bestPriority = lib.priority;
		}
	}
	return hit;
}

export function hasIcon( name: unknown ): boolean {
	return getIcon( name ) !== null;
}

/** Canonical name for a (possibly-aliased / missing) input. Falls back to `star`. */
export function getIconName( name: unknown ): string {
	const key = resolveIconName( name );
	if ( key && hasIcon( key ) ) return key;
	return FALLBACK_NAME;
}

export interface IconSearchResult { name: string; def: IconDef }

/** Flatten every registered icon, highest-priority wins on collisions. Order: priority desc, then name asc. */
export function listIcons(): IconSearchResult[] {
	const seen = new Map< string, { lib: IconLibrary; def: IconDef } >();
	for ( const lib of LIBRARIES.values() ) {
		for ( const [ name, def ] of Object.entries( lib.icons ) ) {
			const prev = seen.get( name );
			if ( ! prev || lib.priority > prev.lib.priority ) {
				seen.set( name, { lib, def } );
			}
		}
	}
	return Array.from( seen.entries() )
		.sort( ( a, b ) => a[ 0 ].localeCompare( b[ 0 ] ) )
		.map( ( [ name, { def } ] ) => ( { name, def } ) );
}

export function listCategories(): string[] {
	const set = new Set< string >();
	for ( const { def } of listIcons() ) {
		if ( def.category ) set.add( def.category );
	}
	return Array.from( set ).sort();
}

/** Token-based fuzzy search over name + label + keywords. */
export function searchIcons( query: string ): IconSearchResult[] {
	const needle = String( query ?? '' ).trim().toLowerCase();
	const all = listIcons();
	if ( ! needle ) return all;
	const tokens = needle.split( /\s+/ );
	return all.filter( ( { name, def } ) => {
		const haystack = [
			name,
			def.label,
			def.category ?? '',
			...( def.keywords ?? [] ),
		].join( ' ' ).toLowerCase();
		return tokens.every( ( t ) => haystack.includes( t ) );
	} );
}

/** Names that exist in any registered library (excluding aliases). Stable order, useful for AI sanitizers. */
export function getIconNames(): string[] {
	return listIcons().map( ( { name } ) => name );
}

/** All accepted input names: registered + aliases. */
export function getAllAcceptedNames(): string[] {
	return [ ...new Set( [ ...getIconNames(), ...Object.keys( ALIASES ) ] ) ].sort();
}

if ( typeof window !== 'undefined' ) {
	const ns = ( window.blicks ??= {} );
	ns.icons = {
		register: registerIconLibrary,
		registerAlias: registerIconAlias,
		list: listIcons,
		search: searchIcons,
	};
}

// --- back-compat aliases for the legacy 12-icon set --------------------------
registerIconAliases( {
	arrowRight: 'arrow-right',
	bolt:       'zap',
} );

// NB: The curated Lucide library is registered by `./bootstrap`, not here. Keeping
// `index.ts` free of the auto-registration side-effect avoids a TDZ on the `LIBRARIES`
// map (ESM hoists imports above any `const`/`let` in this file).
