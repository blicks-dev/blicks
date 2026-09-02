/**
 * Live theme colour palette for the colour controls.
 *
 * Fed at editor load by `BlockServiceProvider` via `window.blicksEditorSettings.colorPalette`
 * (source: `Catalogue::colorPalette()` → the design-system presets = shadcn semantic tokens ∪ the
 * active theme's palette accents, carrying the active design theme's values). The picker inherits
 * the **real presets** instead of the fixed plugin token list. Read synchronously — the inline
 * script lands before the editor bundle, same pattern as the font library.
 *
 * Store value per pick (every preset slug has a `--blicks-color-{slug}` var emitted by CssVariables):
 *   - a slug that IS a static Blicks colour token (background/primary/… — the shadcn semantic set)
 *     stays a bare slug → the engine resolves it to `var(--blicks-color-{slug})` (Blicks-native,
 *     integrates with the admin token editor, back-compatible with existing saved blocks);
 *   - any other preset (a theme brand accent) stores `var(--blicks-color-{slug})` verbatim — the
 *     engine passes it through (its colour check is the static `isToken`, which doesn't know the
 *     theme-only slugs) and it stays live-linked to the design system.
 */
import { isToken } from '@/design-system/tokens';

export type PaletteColor = { name: string; slug: string; color: string };

let cached: PaletteColor[] | null = null;

function readFromWindow(): PaletteColor[] {
	if ( typeof window === 'undefined' ) return [];

	const raw = window.blicksEditorSettings?.colorPalette;
	if ( ! Array.isArray( raw ) ) return [];

	const list: PaletteColor[] = [];
	const seen = new Set< string >();
	for ( const item of raw ) {
		if ( typeof item !== 'object' || item === null ) continue;
		const entry = item as Partial< PaletteColor >;
		if ( typeof entry.slug !== 'string' || typeof entry.color !== 'string' ) continue;
		if ( seen.has( entry.slug ) ) continue;
		seen.add( entry.slug );
		list.push( {
			slug: entry.slug,
			name: typeof entry.name === 'string' ? entry.name : entry.slug,
			color: entry.color,
		} );
	}
	return list;
}

/** The active theme's palette (cached). Empty on the server or when the bridge is absent. */
export function getThemePalette(): PaletteColor[] {
	if ( cached === null ) cached = readFromWindow();
	return cached;
}

/** Component-friendly alias — the palette is static per editor load, so this is a plain read. */
export function useThemePalette(): PaletteColor[] {
	return getThemePalette();
}

/** The value to store for a palette slug (see module doc). */
export function paletteStoreValue( slug: string ): string {
	return isToken( 'color', slug ) ? slug : `var(--blicks-color-${ slug })`;
}

// Matches either namespace: `--blicks-color-{slug}` (design-system presets) or the legacy
// `--wp--preset--color--{slug}` (values saved by the earlier theme-palette attempt).
const VAR_RE = /^var\(\s*--(?:blicks-color-|wp--preset--color--)([a-zA-Z0-9-]+)\s*\)$/;

/** The palette slug a stored value points at — handles a bare Blicks slug and either var form. */
export function paletteSlugOfValue( value: string ): string | null {
	if ( ! value ) return null;
	const match = value.match( VAR_RE );
	return match ? match[ 1 ] : value;
}

/** True when a stored value came from the palette (a Blicks colour token, a var ref, or a slug). */
export function isThemeColorValue( value: string ): boolean {
	if ( ! value ) return false;
	if ( isToken( 'color', value ) || VAR_RE.test( value ) ) return true;
	// A bare palette slug that isn't a static Blicks token (theme brand accent).
	return getThemePalette().some( ( color ) => color.slug === value );
}

/** Resolve a stored value to its palette entry (for the selected-state highlight + display name). */
export function matchPalette( value: string, palette: PaletteColor[] ): PaletteColor | undefined {
	const slug = paletteSlugOfValue( value );
	return slug ? palette.find( ( color ) => color.slug === slug ) : undefined;
}
