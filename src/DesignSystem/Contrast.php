<?php
/**
 * WCAG relative luminance and contrast ratio for token colours.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the colour notations a theme palette uses in practice (`#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`, `rgb()` / `rgba()` with commas or spaces) and answers how well two of them contrast.
 * Anything else (`var()`, `color-mix()`, `hsl()`, `oklch()`, names) reads as unknown, so a caller can
 * leave it alone rather than guess.
 */
final class Contrast {

	/**
	 * WCAG 2 relative luminance, 0 (black) to 1 (white); null when the colour can't be read. Alpha is
	 * ignored: a translucent fill's real luminance depends on what sits behind it.
	 */
	public static function luminance( string $color ): ?float {
		$rgb = self::rgb( trim( strtolower( $color ) ) );
		if ( null === $rgb ) {
			return null;
		}

		$linear = array_map(
			static function ( int $channel ): float {
				$c = $channel / 255;
				return $c <= 0.04045 ? $c / 12.92 : ( ( $c + 0.055 ) / 1.055 ) ** 2.4;
			},
			$rgb
		);

		return 0.2126 * $linear[0] + 0.7152 * $linear[1] + 0.0722 * $linear[2];
	}

	/** WCAG 2 contrast ratio of two luminances, 1 to 21. */
	public static function ratio( float $a, float $b ): float {
		return ( max( $a, $b ) + 0.05 ) / ( min( $a, $b ) + 0.05 );
	}

	/** @return array{0: int, 1: int, 2: int}|null */
	private static function rgb( string $color ): ?array {
		if ( 1 === preg_match( '/^#([0-9a-f]{3,8})$/', $color, $m ) ) {
			$hex = $m[1];
			$length = strlen( $hex );
			if ( 3 === $length || 4 === $length ) {
				return [ (int) hexdec( $hex[0] . $hex[0] ), (int) hexdec( $hex[1] . $hex[1] ), (int) hexdec( $hex[2] . $hex[2] ) ];
			}
			if ( 6 === $length || 8 === $length ) {
				return [ (int) hexdec( substr( $hex, 0, 2 ) ), (int) hexdec( substr( $hex, 2, 2 ) ), (int) hexdec( substr( $hex, 4, 2 ) ) ];
			}
			return null;
		}

		if ( 1 === preg_match( '/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,\/][^)]*)?\)$/', $color, $m ) ) {
			$channels = [ (int) $m[1], (int) $m[2], (int) $m[3] ];
			foreach ( $channels as $channel ) {
				if ( $channel > 255 ) {
					return null;
				}
			}
			return $channels;
		}

		return null;
	}
}
