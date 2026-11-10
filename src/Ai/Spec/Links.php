<?php
/**
 * Which link targets an agent may write.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One rule for every link an agent writes, wherever it ends up — a block attribute, a link inside
 * rich text, a block from another plugin.
 *
 * **Judged as the browser will read it.** A link is stored inside an HTML attribute, and the
 * browser decodes character references there before it looks at the scheme. So
 * `java&#115;cript:alert(1)` and `javascript&colon;alert(1)` are `javascript:` links, even though
 * neither matches a scheme pattern as written. The value is decoded first, then stripped of the
 * whitespace and control characters a browser ignores inside a scheme, and only then checked.
 */
final class Links {

	/** The schemes a link may use. Anything without a scheme is a relative link, and fine. */
	public const SCHEMES = [ 'http', 'https', 'mailto', 'tel' ];

	public static function isSafe( string $value ): bool {
		$scheme = self::scheme( $value );

		return null === $scheme || in_array( $scheme, self::SCHEMES, true );
	}

	/**
	 * The scheme a browser would see, lower-cased, or null for a relative link.
	 *
	 * Decoded until it stops changing (three rounds at most): a double-encoded reference is
	 * harmless in a browser, but a check that is stricter than the browser costs nothing here.
	 */
	public static function scheme( string $value ): ?string {
		for ( $round = 0; $round < 3; $round++ ) {
			$decoded = html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

			if ( $decoded === $value ) {
				break;
			}

			$value = $decoded;
		}

		$value = (string) preg_replace( '/[\x00-\x20\x7F]+/', '', $value );

		if ( 1 !== preg_match( '/^([^\/?#]*?):/', $value, $match ) ) {
			return null;
		}

		// Anything before the first colon that is not a valid scheme name — `&`, `;`, a quote —
		// would have been decoded above; what is left either is a scheme or is not a link a
		// browser treats as one. Treat the odd cases as a scheme so they are refused, not passed.
		return strtolower( $match[1] );
	}
}
