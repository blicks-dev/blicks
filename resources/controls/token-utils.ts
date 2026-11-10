/**
 * Token-library helpers for inspector controls.
 *
 * Bridges the design-token catalogue into control UIs: option lists for library
 * popovers/grids, blur-validation patterns that accept token slugs alongside
 * literal lengths (the style engine already resolves slugs via
 * `valOrToken`/`toCssValue`), datalist suggestions, and live CSS-variable
 * resolution for value previews.
 *
 * The **slug list** per category prefers the live, theme/admin-projected catalogue
 * bridged at editor load via `window.blicksEditorSettings.tokenCatalogue` (see
 * `Catalogue::tokenCatalogue()`), falling back to the static compiled
 * `resources/design-system/tokens.json` for any category the bridge doesn't carry
 * (e.g. an older cached editor bundle, or `color`/`fontFamily` which have their own
 * dedicated bridges — see `color/palette.ts` and `typography/font-library.ts`).
 */
import { isToken, TOKENS } from '@/design-system/tokens';
import type { TokenCategory } from '@/framework/types';
import { titleCase, tokenVar } from '@/framework/design-system';

export type TokenOption = {
	slug: string;
	label: string;
	varName: string;
	css: string;
	/** What picking it stores: see tokenStoreValue(). */
	value: string;
};

type LiveTokenRow = { slug: string; name: string; value: string };
type LiveCatalogue = Partial< Record< TokenCategory, LiveTokenRow[] > >;

let cachedLiveCatalogue: LiveCatalogue | null = null;

function readLiveCatalogue(): LiveCatalogue {
	if ( typeof window === 'undefined' ) return {};
	const raw = window.blicksEditorSettings?.tokenCatalogue;
	return raw && typeof raw === 'object' ? ( raw as LiveCatalogue ) : {};
}

/** The live token catalogue bridge (cached — static per editor load, like the colour palette). */
function liveCatalogue(): LiveCatalogue {
	if ( cachedLiveCatalogue === null ) cachedLiveCatalogue = readLiveCatalogue();
	return cachedLiveCatalogue;
}

/** The slug list for a category: live-bridged scale when present, else the static catalogue. */
function slugsFor( category: TokenCategory ): readonly string[] {
	const rows = liveCatalogue()[ category ];
	return rows ? rows.map( row => row.slug ) : TOKENS[ category ];
}

/** Library options for a category, preferring the live theme/admin-projected catalogue. */
export function tokenOptions( category: TokenCategory ): TokenOption[] {
	return slugsFor( category ).map( slug => {
		const varName = tokenVar( category, slug );
		return { slug, label: titleCase( slug ), varName, css: `var(${ varName })`, value: tokenStoreValue( category, slug ) };
	} );
}

/**
 * What a picked token is stored as. The engine resolves a bare slug only when it is in
 * `tokens.json` — both engines read that one static list. A theme's own preset (Twenty
 * Twenty-Five's spacing `50`, its colour `contrast`) is printed as `--blicks-<category>-<slug>`
 * but would be written raw as a bare slug: `50` became `50px`, `contrast` no colour at all. So a
 * slug the engine does not know is stored as its variable, which carries the theme's real value.
 *
 * Shadows keep the bare slug: the shadow builder takes only an engine slug or layers, and drops a
 * `var()` just as it drops an unknown slug.
 */
export function tokenStoreValue( category: TokenCategory, slug: string ): string {
	return isToken( category, slug ) || category === 'shadow' ? slug : `var(${ tokenVar( category, slug ) })`;
}

/** The slug a stored value points at: a bare slug, or `var(--blicks-<category>-<slug>)`. */
export function tokenSlugOfValue( category: TokenCategory, value: string ): string {
	const prefix = tokenVar( category, '' ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	const match = new RegExp( `^var\\(\\s*${ prefix }([a-zA-Z0-9-]+)\\s*\\)$` ).exec( value.trim() );
	return match ? match[ 1 ] : value;
}

/** `base` validation pattern extended to also accept the category's token slugs. */
export function lengthOrTokenPattern( category: TokenCategory, base: RegExp ): RegExp {
	const literal = base.source.replace( /^\^/, '' ).replace( /\$$/, '' );
	// The stored forms: a bare engine slug, or a theme preset's `var(--blicks-…)`.
	const slugs = slugsFor( category )
		.map( slug => tokenStoreValue( category, slug ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) )
		.join( '|' );

	return new RegExp( `^(?:${ literal }|${ slugs })$` );
}

/** Datalist suggestions: token slugs first, then literal examples (deduped). */
export function tokenSuggestions( category: TokenCategory, extra: readonly string[] = [] ): string[] {
	return [ ...new Set( [ ...slugsFor( category ).map( ( slug ) => tokenStoreValue( category, slug ) ), ...extra ] ) ];
}

/**
 * Resolve the category's current CSS values from the live document. The editor
 * canvas iframe is preferred — it always carries the runtime `--blicks-*` vars;
 * the top document is the fallback.
 * Iterates the same slug list as `tokenOptions()` so previews line up with the
 * options actually offered.
 */
export function resolveTokenValues( category: TokenCategory ): Record< string, string > {
	if ( typeof document === 'undefined' ) {
		return {};
	}

	const canvas = document.querySelector< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' )?.contentDocument?.documentElement;
	const canvasStyle = canvas ? getComputedStyle( canvas ) : null;
	const topStyle = getComputedStyle( document.documentElement );
	const values: Record< string, string > = {};

	for ( const slug of slugsFor( category ) ) {
		const varName = tokenVar( category, slug );
		values[ slug ] = canvasStyle?.getPropertyValue( varName ).trim() || topStyle.getPropertyValue( varName ).trim() || '';
	}

	return values;
}
