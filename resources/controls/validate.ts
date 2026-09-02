/**
 * Value sanitisers, kept free of JSX so they can be unit-tested on their own — importing them
 * from `common.tsx` drags the whole editor bundle into a test that only wants a regex.
 *
 * Re-exported from `common.tsx`, so every existing import site is unaffected.
 */
export function cleanValue( raw: string ) {
	return raw.replace( /\s+/g, '' );
}

export function validateOrEmpty( raw: string, pattern: RegExp ) {
	const cleaned = cleanValue( raw );
	if ( cleaned === '' ) return '';
	return pattern.test( cleaned ) ? cleaned : '';
}

/**
 * `validateOrEmpty` for the values whose spaces are part of the value — `right bottom`,
 * `100% auto`, `2rem 40px`.
 *
 * The plain one deletes every space before testing, which is right for a single length (nobody
 * means `1 0px`) and silently destructive for a pair: `right bottom` became `rightbottom`, failed
 * its own pattern, and cleared the field the author had just filled in. Here runs of whitespace
 * collapse to one instead.
 */
export function validateSpaced( raw: string, pattern: RegExp ) {
	const cleaned = raw.trim().replace( /\s+/g, ' ' );
	if ( cleaned === '' ) return '';
	return pattern.test( cleaned ) ? cleaned : '';
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Values every CSS property takes, whatever its own value space is. */
const CSS_WIDE = [ 'inherit', 'initial', 'unset', 'revert', 'revert-layer' ];

/** `var(…)`, `calc(…)`, `env(…)` — a token reference or a computed value, on any property. */
const CSS_FUNCTION = '[a-zA-Z-]+\\([^]*\\)';

/**
 * A pattern for a property whose value space is a fixed keyword list.
 *
 * Without one, a keyword field is a free-text box: `object-fit: 12px` and
 * `animation-iteration-count: 600ms` commit happily and emit CSS the browser drops, so the block
 * looks unstyled with no clue why. The list is still not a hard enum — CSS-wide keywords and
 * `var()`/`calc()` pass, so a token or a value newer than this build is never locked out; what it
 * rejects is a value from the wrong value space entirely (a length, a time, a bare number).
 *
 * `multi` allows a space-separated combination, for the properties that take one
 * (`contain: layout paint`).
 */
export function keywordPattern(
	values: readonly string[],
	{ multi = false }: { multi?: boolean } = {}
): RegExp {
	const keywords = [ ...new Set( [ ...values, ...CSS_WIDE ] ) ]
		.filter( Boolean )
		.map( ( value ) => value.replace( ESCAPE, '\\$&' ) )
		.join( '|' );
	const one = `(?:${ keywords })`;
	const body = multi ? `${ one }(?: ${ one })*` : one;
	return new RegExp( `^(?:${ body }|${ CSS_FUNCTION })$`, 'i' );
}
