<?php
/**
 * Validation for user-supplied CSS dimension values.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates one user-supplied dimension before it is interpolated into a block wrapper's `style`
 * attribute.
 *
 * Everything here is an allow-list: an exact keyword, a `<length-percentage>`, a bare number, or a
 * single CSS math / `var()` function whose parentheses balance and whose body is built only from
 * characters that cannot terminate a declaration. A prefix test such as
 * `str_starts_with( $raw, 'var(' )` is **not** enough — it also accepts
 * `var(--a); background: <anything>`, letting a stored value inject extra declarations into the
 * wrapper's style attribute.
 */
final class Dimension {

	/** Longest value worth considering; real dimensions are far shorter. */
	private const MAX = 200;

	/** Bare keywords that are valid for width/height and carry no user data. */
	private const KEYWORDS = [ 'auto', 'none', 'fit-content', 'max-content', 'min-content' ];

	private const LENGTH_RE = '/^-?\d*\.?\d+(px|%|em|rem|vw|vh|svw|svh|dvw|dvh|lvw|lvh|ch|ex|fr|pt|cm|mm|in)$/';

	private const NUMBER_RE = '/^-?\d*\.?\d+$/';

	/**
	 * One CSS math / custom-property function, and nothing else. The character class excludes
	 * `;`, `:`, `{`, `}`, `<`, `>`, quotes and backslashes, so no second declaration, no string
	 * and no tag opening can survive.
	 */
	private const FUNCTION_RE = '/^(?:var|calc|clamp|min|max)\([a-zA-Z0-9 \t.,%_+\/*()-]*\)$/';

	/**
	 * @param mixed $value Raw attribute value.
	 * @param string $fallback Returned whenever the value is empty or not provably safe.
	 */
	public static function clean( $value, string $fallback ): string {
		$raw = trim( (string) ( is_scalar( $value ) ? $value : '' ) );

		if ( '' === $raw || strlen( $raw ) > self::MAX ) {
			return $fallback;
		}

		if ( in_array( $raw, self::KEYWORDS, true ) ) {
			return $raw;
		}

		if ( 1 === preg_match( self::LENGTH_RE, $raw ) ) {
			return $raw;
		}

		// A unitless number means pixels, except zero, which needs no unit.
		if ( 1 === preg_match( self::NUMBER_RE, $raw ) ) {
			return 0.0 === (float) $raw ? '0' : $raw . 'px';
		}

		if ( 1 !== preg_match( self::FUNCTION_RE, $raw ) || 1 === preg_match( '/url\s*\(/i', $raw ) ) {
			return $fallback;
		}

		return self::isOneBalancedFunction( $raw ) ? $raw : $fallback;
	}

	/**
	 * True when the opening parenthesis is closed only at the very end — so a value like
	 * `calc(1px) somethingelse(2px)` cannot pass as a single function.
	 */
	private static function isOneBalancedFunction( string $raw ): bool {
		$depth  = 0;
		$length = strlen( $raw );

		for ( $i = 0; $i < $length; $i++ ) {
			if ( '(' === $raw[ $i ] ) {
				++$depth;
				continue;
			}
			if ( ')' !== $raw[ $i ] ) {
				continue;
			}
			--$depth;
			if ( $depth < 0 || ( 0 === $depth && $i !== $length - 1 ) ) {
				return false;
			}
		}

		return 0 === $depth;
	}
}
