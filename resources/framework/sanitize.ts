/**
 * Strict validation/sanitization for the Advanced-tab custom HTML attributes.
 * **Mirror of `src/Style/Sanitize.php`** — keep the two byte-compatible (parity tests in
 * `sanitize.test.ts` ⇄ `tests/Unit/Style/SanitizeTest.php`). The PHP side is the authoritative
 * front-end gate; this side drives the editor preview + inline validation feedback.
 */

/** Allowed custom-attribute names — an allow-list, never event handlers / style / class. */
const ATTR_NAME_RE = /^(?:data-[a-z0-9-]+|aria-[a-z-]+|role|title|id|lang|dir|tabindex)$/;

const ATTR_VALUE_MAX = 500;

/** ASCII control characters (C0 + DEL) — built via escapes so no raw bytes live in source. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp( '[\\u0000-\\u001F\\u007F]', 'g' );
const SCRIPT_SCHEME = /(?:javascript|vbscript)\s*:/gi;

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

/**
 * Per-name value rules for the few attributes the generic sanitizer cannot judge.
 * `tabindex` is the only one: the browser ignores a non-integer, so a value that fails
 * here is dropped rather than written out as dead markup.
 */
const ATTR_VALUE_RE: Record< string, RegExp > = {
	tabindex: /^-?\d+$/,
};

/**
 * Sanitize a value in the context of its attribute name. Null when the name carries a
 * value rule the value does not satisfy.
 */
export function cleanAttrValueFor( name: string, value: unknown ): string | null {
	const v = cleanAttrValue( value );
	const rule = ATTR_VALUE_RE[ name ];
	return rule && ! rule.test( v ) ? null : v;
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
		const value = cleanAttrValueFor( name, ( item as any )?.value );
		if ( value === null ) continue;
		byName.set( name, value );
	}
	return Array.from( byName, ( [ name, value ] ) => ( { name, value } ) );
}

/** True when a row's name is non-empty but invalid — drives the editor's inline error state. */
export function isAttrNameInvalid( name: unknown ): boolean {
	const n = String( name ?? '' ).trim();
	return n !== '' && cleanAttrName( n ) === null;
}
