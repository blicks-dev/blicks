/**
 * Whole-value validation for CSS declaration values — **mirror of `src/Style/CssValue.php`**.
 *
 * The PHP class is the authoritative front-end gate. This copy keeps the editor canvas and the
 * admin preview honest: a value the server would drop is dropped here too, so what an author sees
 * is what visitors get, and a hostile value cannot style the editor of whoever opens the post.
 * Parity is pinned by `css-value.test.ts` ⇄ `tests/Unit/Style/CssValueTest.php`.
 *
 * Allow-list, never a denylist of bad substrings:
 *  1. every character in {@link ALLOWED_CHARS} — no `;` `:` `{` `}` `<` `>` `\` `@` `!` `&`, no
 *     control characters; any code point above U+007F is allowed (none can end a string or rule);
 *  2. parentheses balance and never go negative;
 *  3. every string that opens closes, and comment markers are refused;
 *  4. every `name(` names a function in {@link ALLOWED_FUNCTIONS}.
 * A failing value yields `''` and the caller drops the declaration.
 */

const MAX = 500;

const ALLOWED_CHARS = /^[A-Za-z0-9 \t.,%#+\-*/()_[\]='"\u0080-\u{10FFFF}]*$/u;

const ALLOWED_FUNCTIONS = new Set( [
	// Substitution and maths. `attr()` is deliberately absent: `attr(data-x url)` reads a URL
	// from an attribute the author also controls.
	'var', 'calc', 'clamp', 'min', 'max', 'minmax', 'env', 'counter', 'counters',
	// Colour.
	'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark',
	// Gradients.
	'linear-gradient', 'radial-gradient', 'conic-gradient',
	'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient',
	// Shapes.
	'polygon', 'circle', 'ellipse', 'inset', 'path', 'rect', 'xywh',
	// Filters.
	'blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'invert', 'opacity', 'hue-rotate', 'drop-shadow',
	// Transforms.
	'translate', 'translatex', 'translatey', 'translatez', 'translate3d',
	'rotate', 'rotatex', 'rotatey', 'rotatez', 'rotate3d',
	'scale', 'scalex', 'scaley', 'scalez', 'scale3d',
	'skew', 'skewx', 'skewy', 'matrix', 'matrix3d', 'perspective',
	// Timing and layout.
	'cubic-bezier', 'steps', 'linear', 'repeat', 'fit-content',
	// Scroll-driven animation timelines.
	'scroll', 'view',
	// CSS Values 4 maths.
	'round', 'mod', 'rem', 'abs', 'sign', 'pow', 'sqrt', 'hypot',
	'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'log',
] );

const URL_SCHEMES = new Set( [ 'http', 'https' ] );

/** PHP `trim()` strips only these; `String.prototype.trim` also strips NBSP and other spaces. */
function phpTrim( s: string ): string {
	// eslint-disable-next-line no-control-regex
	return s.replace( /^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '' );
}

/** PHP `is_scalar` + string cast: booleans become '1' / '', everything non-scalar is ''. */
function scalarString( value: unknown ): string {
	if ( typeof value === 'string' ) return value;
	if ( typeof value === 'number' ) return String( value );
	if ( typeof value === 'boolean' ) return value ? '1' : '';
	return '';
}

/** PHP `strlen` counts bytes; match it so a value near the cap is judged identically. */
function byteLength( s: string ): number {
	return new TextEncoder().encode( s ).length;
}

function parensBalance( s: string ): boolean {
	let depth = 0;
	for ( const c of s ) {
		if ( c === '(' ) {
			depth++;
		} else if ( c === ')' && --depth < 0 ) {
			return false;
		}
	}
	return depth === 0;
}

/** Scan like the tokenizer: inside a string only its own quote closes it. */
function quotesClose( s: string ): boolean {
	let open = '';
	for ( const c of s ) {
		if ( open ) {
			if ( c === open ) open = '';
			continue;
		}
		if ( c === '"' || c === "'" ) open = c;
	}
	return open === '';
}

function functionsAllowed( s: string ): boolean {
	for ( const match of s.matchAll( /([A-Za-z][A-Za-z0-9-]*)\s*\(/g ) ) {
		if ( ! ALLOWED_FUNCTIONS.has( match[ 1 ].toLowerCase() ) ) return false;
	}
	return true;
}

/** Validate one CSS value. Returns it unchanged when it passes, `''` when it does not. */
export function cleanCssValue( value: unknown ): string {
	const s = phpTrim( scalarString( value ) );
	if ( s === '' || byteLength( s ) > MAX ) return '';
	if ( ! ALLOWED_CHARS.test( s ) ) return '';
	if ( s.includes( '/*' ) || s.includes( '*/' ) ) return '';
	if ( ! quotesClose( s ) ) return '';
	if ( ! parensBalance( s ) ) return '';
	if ( ! functionsAllowed( s ) ) return '';
	return s;
}

/**
 * Validate a URL destined for `url("…")`, or `''`. Absolute http(s) and site-relative paths only;
 * anything carrying whitespace, a quote, backslash, paren or angle bracket is refused.
 */
export function cleanCssUrl( value: unknown ): string {
	const raw = phpTrim( scalarString( value ) );
	if ( raw === '' || byteLength( raw ) > MAX ) return '';
	// eslint-disable-next-line no-control-regex
	if ( /[\x00-\x20\x7F"'\\()<>]/.test( raw ) ) return '';
	if ( raw.startsWith( '//' ) ) return '';
	if ( raw.startsWith( '/' ) ) return raw;
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec( raw );
	return scheme && URL_SCHEMES.has( scheme[ 1 ].toLowerCase() ) ? raw : '';
}
