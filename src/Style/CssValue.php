<?php
/**
 * Whole-value validation for CSS declaration values produced by the style engine.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates one CSS declaration value before the style engine interpolates it into output.
 *
 * The engine has two sinks, and an unvalidated value escapes both:
 *
 *  - `ElementStyle::blockProps()` joins `--var:value` pairs with `;` into a wrapper `style`
 *    attribute. `esc_attr()` does not touch `;` or `:`, so a `;` inside a value opens a second
 *    declaration on the element.
 *  - `ElementStyle::emitScoped()` wraps values in `.bl-{id}{prop:value}` and queues them for the
 *    page stylesheet. A `}` inside a value closes the rule and lets the next characters start a
 *    new one with an arbitrary selector.
 *
 * Both are reachable from block attributes, which travel in the block-delimiter HTML comment and
 * are therefore not filtered by `wp_kses_post()` — a Contributor without `unfiltered_html` can set
 * them.
 *
 * The guard is an allow-list on the whole value, never a denylist of bad substrings:
 *
 *  1. every character must be in {@see self::ALLOWED_CHARS} — which excludes `;` `:` `{` `}` `<`
 *     `>` `\` `@` `!` `&` and every control character, so neither sink can be escaped;
 *  2. parentheses must balance and never go negative;
 *  3. quotes must balance, and CSS comment markers are refused outright;
 *  4. every `name(` in the value must name a function in {@see self::ALLOWED_FUNCTIONS}.
 *
 * A value that fails any check yields `''`, and the caller drops the declaration rather than
 * emitting a partially-scrubbed one. Rejecting whole values keeps the failure mode obvious: the
 * declaration is missing, not silently mangled into something else.
 */
final class CssValue {

	/** Longest value the engine will emit. Real declarations are far shorter. */
	private const MAX = 500;

	/**
	 * Characters a value may contain.
	 *
	 * `:` is absent on purpose — it is the separator the engine itself writes between property and
	 * value, so a value containing one could forge a declaration. URLs need it and are handled by
	 * {@see self::url()}, which never routes through here.
	 *
	 * `[` and `]` are permitted: grid line names (`[col-start]`) need them and neither can
	 * terminate a declaration or a rule block.
	 */
	private const ALLOWED_CHARS = '/^[A-Za-z0-9 \t.,%#+\-*\/()_\[\]=\'"]*$/';

	/** CSS functions the engine is allowed to emit. Anything else fails the whole value. */
	private const ALLOWED_FUNCTIONS = [
		// Substitution and maths.
		'var',
		'calc',
		'clamp',
		'min',
		'max',
		'minmax',
		'env',
		'attr',
		'counter',
		'counters',
		// Colour.
		'rgb',
		'rgba',
		'hsl',
		'hsla',
		'hwb',
		'lab',
		'lch',
		'oklab',
		'oklch',
		'color',
		'color-mix',
		// Gradients.
		'linear-gradient',
		'radial-gradient',
		'conic-gradient',
		'repeating-linear-gradient',
		'repeating-radial-gradient',
		'repeating-conic-gradient',
		// Shapes (clip-path, mask, offset-path).
		'polygon',
		'circle',
		'ellipse',
		'inset',
		'path',
		'rect',
		'xywh',
		// Filters.
		'blur',
		'brightness',
		'contrast',
		'saturate',
		'grayscale',
		'sepia',
		'invert',
		'opacity',
		'hue-rotate',
		'drop-shadow',
		// Transforms.
		'translate',
		'translatex',
		'translatey',
		'translatez',
		'translate3d',
		'rotate',
		'rotatex',
		'rotatey',
		'rotatez',
		'rotate3d',
		'scale',
		'scalex',
		'scaley',
		'scalez',
		'scale3d',
		'skew',
		'skewx',
		'skewy',
		'matrix',
		'matrix3d',
		'perspective',
		// Timing and layout.
		'cubic-bezier',
		'steps',
		'linear',
		'repeat',
		'fit-content',
		// Scroll-driven animation timelines (`animation-timeline: scroll()` / `view()`).
		'scroll',
		'view',
		// CSS Values 4 maths.
		'round',
		'mod',
		'rem',
		'abs',
		'sign',
		'pow',
		'sqrt',
		'hypot',
		'sin',
		'cos',
		'tan',
		'asin',
		'acos',
		'atan',
		'atan2',
		'exp',
		'log',
	];

	/** URL schemes an image value may use. Relative paths are also accepted. */
	private const URL_SCHEMES = [ 'http', 'https' ];

	/**
	 * Validate one CSS value. Returns the value unchanged when it passes, `''` when it does not.
	 *
	 * @param mixed $value Raw value from a block attribute or a style-engine builder.
	 */
	public static function clean( $value ): string {
		$s = trim( (string) ( is_scalar( $value ) ? $value : '' ) );

		if ( '' === $s || strlen( $s ) > self::MAX ) {
			return '';
		}
		if ( 1 !== preg_match( self::ALLOWED_CHARS, $s ) ) {
			return '';
		}
		// Comment markers would let a value swallow the declarations the engine writes after it.
		if ( str_contains( $s, '/*' ) || str_contains( $s, '*/' ) ) {
			return '';
		}
		if ( substr_count( $s, '"' ) % 2 !== 0 || substr_count( $s, "'" ) % 2 !== 0 ) {
			return '';
		}
		if ( ! self::parensBalance( $s ) ) {
			return '';
		}
		if ( ! self::functionsAllowed( $s ) ) {
			return '';
		}

		return $s;
	}

	/**
	 * Validate a list of values, returning `''` unless every one of them passes.
	 *
	 * Used where several values compose a single declaration (a shadow's offsets and colour, a
	 * shape's amount): a partially-valid composite is not a safe declaration, it is a broken one.
	 *
	 * @param list<mixed> $values
	 */
	public static function allClean( array $values ): bool {
		foreach ( $values as $value ) {
			if ( '' === self::clean( $value ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Validate a URL destined for `url("…")` and return it escaped for that context, or `''`.
	 *
	 * Kept apart from {@see self::clean()} because a URL legitimately needs `:` and `?`, which no
	 * other value may contain. Only absolute http(s) URLs and site-relative paths are accepted, so
	 * `javascript:`, `data:` and protocol-relative URLs are all refused.
	 */
	public static function url( $value ): string {
		$raw = trim( (string) ( is_scalar( $value ) ? $value : '' ) );

		if ( '' === $raw || strlen( $raw ) > self::MAX ) {
			return '';
		}
		// Control characters, quotes, backslashes, parens and whitespace would all break out of
		// `url("…")` or let the value be re-parsed as something else.
		if ( 1 === preg_match( '/[\x00-\x20\x7F"\'\\\\()<>]/', $raw ) ) {
			return '';
		}

		if ( str_starts_with( $raw, '//' ) ) {
			return '';
		}

		if ( str_starts_with( $raw, '/' ) ) {
			return $raw;
		}

		$scheme = strtolower( (string) wp_parse_url( $raw, PHP_URL_SCHEME ) );
		if ( ! in_array( $scheme, self::URL_SCHEMES, true ) ) {
			return '';
		}

		return $raw;
	}

	/**
	 * True when every `(` is closed and none closes before it opens.
	 *
	 * Unbalanced parentheses are how a value smuggles the remainder of a rule past a naive check:
	 * `calc(1px` leaves the following declarations inside the open function.
	 */
	private static function parensBalance( string $s ): bool {
		$depth  = 0;
		$length = strlen( $s );

		for ( $i = 0; $i < $length; $i++ ) {
			if ( '(' === $s[ $i ] ) {
				++$depth;
				continue;
			}
			if ( ')' === $s[ $i ] && --$depth < 0 ) {
				return false;
			}
		}

		return 0 === $depth;
	}

	/** True when every function call in the value names an allow-listed function. */
	private static function functionsAllowed( string $s ): bool {
		if ( ! preg_match_all( '/([A-Za-z][A-Za-z0-9-]*)\s*\(/', $s, $matches ) ) {
			return true;
		}

		foreach ( $matches[1] as $name ) {
			if ( ! in_array( strtolower( $name ), self::ALLOWED_FUNCTIONS, true ) ) {
				return false;
			}
		}

		return true;
	}
}
