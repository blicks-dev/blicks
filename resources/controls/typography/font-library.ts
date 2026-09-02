/**
 * Live font-family list, fed at editor load by `BlockServiceProvider::registerBlocks()`
 * via `window.blicksEditorSettings.fontLibrary`. Source = `wp_get_global_settings()
 * ['typography']['fontFamilies']`, which covers both theme.json presets AND families
 * installed through the native WP Font Library (Google Fonts, self-hosted).
 *
 * Consumers (the typography selector + the AI control catalogue) read this
 * synchronously — there is no async fetch race, the inline script lands before
 * the editor bundle executes. After a Font Library install/uninstall, callers
 * can refresh the cache via `refreshFontLibrary()`.
 */

export interface FontFamilyEntry {
	/** WP slug — also the `--wp--preset--font-family--{slug}` CSS variable suffix. */
	slug: string;
	/** Human-readable name as written in theme.json. */
	name: string;
	/** CSS font-family stack as written by theme.json. */
	fontFamily: string;
	/** `theme` (baked into theme.json) or `user` (installed via the Font Library). */
	source: string;
}

let cached: FontFamilyEntry[] | null = null;

function readFromWindow(): FontFamilyEntry[] {
	if ( typeof window === 'undefined' ) return [];

	const raw = ( window.blicks?.fontLibrary as unknown ) ?? window.blicksEditorSettings?.fontLibrary;
	if ( ! Array.isArray( raw ) ) return [];

	const list: FontFamilyEntry[] = [];
	for ( const item of raw ) {
		if ( typeof item !== 'object' || item === null ) continue;
		const entry = item as Partial< FontFamilyEntry >;
		if ( typeof entry.slug !== 'string' || typeof entry.fontFamily !== 'string' ) continue;
		list.push( {
			slug: entry.slug,
			name: typeof entry.name === 'string' ? entry.name : entry.slug,
			fontFamily: entry.fontFamily,
			source: typeof entry.source === 'string' ? entry.source : 'theme',
		} );
	}
	return list;
}

/** Cached read — call once per render. Empty on the server or when the bridge is absent. */
export function getFontLibrary(): FontFamilyEntry[] {
	if ( cached === null ) cached = readFromWindow();
	return cached;
}

/** Find a registered family by slug. */
export function findFontFamily( slug: string ): FontFamilyEntry | undefined {
	return getFontLibrary().find( ( entry ) => entry.slug === slug );
}

/** Drop the cache so the next `getFontLibrary()` re-reads `window`. Use after install/uninstall. */
export function refreshFontLibrary(): void {
	cached = null;
}

/** Replace the cache with an explicit list — used by the Fonts manager after a REST install. */
export function setFontLibrary( next: FontFamilyEntry[] ): void {
	cached = next.slice();
	if ( typeof window !== 'undefined' ) {
		const ns = ( window.blicks ??= {} );
		ns.fontLibrary = cached;
		window.dispatchEvent( new CustomEvent( FONT_LIBRARY_CHANGED ) );
	}
}

export const FONT_LIBRARY_CHANGED = 'blicks:font-library-changed';

/** Subscribe to font-library mutations. Returns an unsubscribe handler. */
export function onFontLibraryChange( handler: () => void ): () => void {
	if ( typeof window === 'undefined' ) return () => undefined;
	const listener = () => handler();
	window.addEventListener( FONT_LIBRARY_CHANGED, listener );
	return () => window.removeEventListener( FONT_LIBRARY_CHANGED, listener );
}
