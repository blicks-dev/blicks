/**
 * Strict validation/sanitization for the Advanced-tab escape hatches (Custom CSS + custom HTML
 * attributes). **Mirror of `src/Style/Sanitize.php`** — keep the two byte-compatible (parity tests
 * in `sanitize.test.ts` ⇄ `tests/Unit/Style/SanitizeTest.php`). The PHP side is the authoritative
 * front-end gate; this side drives the editor preview + inline validation feedback.
 */

/** Allowed custom-attribute names — an allow-list, never event handlers / style / class. */
const ATTR_NAME_RE = /^(?:data-[a-z0-9-]+|aria-[a-z-]+|role|title|id|lang|dir)$/;

const ATTR_VALUE_MAX = 500;
const CSS_MAX = 10000;

/** ASCII control characters (C0 + DEL) — built via escapes so no raw bytes live in source. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp( '[\\u0000-\\u001F\\u007F]', 'g' );
const SCRIPT_SCHEME = /(?:javascript|vbscript)\s*:/gi;

/** Dangerous CSS constructs, stripped from Custom CSS. Each entry's label is surfaced to the UI. */
const CSS_BLOCKLIST: Array< { label: string; re: RegExp } > = [
	{ label: '<', re: /</g },
	{ label: '@import', re: /@import[^;]*;?/gi },
	{ label: '@charset/@namespace', re: /@(?:charset|namespace)[^;]*;?/gi },
	{ label: 'expression()', re: /expression\s*\(/gi },
	{ label: 'javascript:/vbscript:', re: SCRIPT_SCHEME },
	{ label: 'data:text/html', re: /data:\s*text\/html/gi },
	{ label: 'url()', re: /url\s*\(/gi },
	{ label: 'behavior/-moz-binding', re: /(?:-moz-binding|behavior)\s*:/gi },
];

/** Validate one attribute name. Returns the normalised (lowercased) name, or null if disallowed. */
export function cleanAttrName( name: unknown ): string | null {
	const n = String( name ?? '' ).trim().toLowerCase();
	return ATTR_NAME_RE.test( n ) ? n : null;
}

/** Sanitize one attribute value: strip control chars + dangerous URL schemes, cap length. */
export function cleanAttrValue( value: unknown ): string {
	let v = String( value ?? '' )
		.replace( CONTROL_CHARS, '' )
		.replace( SCRIPT_SCHEME, '' )
		.trim();
	if ( v.length > ATTR_VALUE_MAX ) v = v.slice( 0, ATTR_VALUE_MAX );
	return v;
}

/** Validate a list of `{name,value}` rows → only valid, sanitized entries (last write wins per name). */
export function cleanAttributes(
	list: unknown
): Array< { name: string; value: string } > {
	if ( ! Array.isArray( list ) ) return [];
	const byName = new Map< string, string >();
	for ( const item of list ) {
		const name = cleanAttrName( ( item as any )?.name );
		if ( ! name ) continue;
		byName.set( name, cleanAttrValue( ( item as any )?.value ) );
	}
	return Array.from( byName, ( [ name, value ] ) => ( { name, value } ) );
}

/** True when a row's name is non-empty but invalid — drives the editor's inline error state. */
export function isAttrNameInvalid( name: unknown ): boolean {
	const n = String( name ?? '' ).trim();
	return n !== '' && cleanAttrName( n ) === null;
}

/** Sanitize Custom CSS: strip dangerous constructs, cap length. Returns the safe CSS + what was blocked. */
export function sanitizeCss( raw: unknown ): { css: string; blocked: string[] } {
	let css = String( raw ?? '' );
	if ( css.length > CSS_MAX ) css = css.slice( 0, CSS_MAX );
	const blocked: string[] = [];
	for ( const { label, re } of CSS_BLOCKLIST ) {
		re.lastIndex = 0;
		if ( re.test( css ) ) {
			blocked.push( label );
			css = css.replace( re, '' );
		}
	}
	return { css, blocked };
}

/** Scope sanitized Custom CSS to one instance: replace the `selector` keyword with `.bl-{id}`. */
export function scopeCss( raw: unknown, scopeId: string ): string {
	if ( ! scopeId ) return '';
	const { css } = sanitizeCss( raw );
	if ( ! css.trim() ) return '';
	return css.split( 'selector' ).join( `.bl-${ scopeId }` );
}
