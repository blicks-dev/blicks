<?php
/**
 * Request-local collector for scoped per-instance CSS.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Request-local collector for already-scoped per-instance CSS.
 *
 * Static blocks feed this from the render_block filter; dynamic render.php files can feed the
 * same queue via ElementStyle::blockProps(). The provider prints the queue once in wp_footer.
 */
final class ScopedCss {

	/** @var array<string, true> */
	private static array $seen = [];

	/** @var list<string> */
	private static array $rules = [];

	public static function add( string $css ): void {
		$css = trim( $css );
		if ( '' === $css || isset( self::$seen[ $css ] ) ) {
			return;
		}

		self::$seen[ $css ] = true;
		self::$rules[] = $css;
	}

	/** @param list<string> $rules */
	public static function addMany( array $rules ): void {
		foreach ( $rules as $rule ) {
			self::add( $rule );
		}
	}

	public static function css(): string {
		return implode( '', self::$rules );
	}

	public static function reset(): void {
		self::$seen = [];
		self::$rules = [];
	}
}
