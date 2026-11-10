<?php
/**
 * CSS shadow text, read into the layer objects the style engine stores.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

use Blicks\Style\Tokens;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lets an agent write `box-shadow` and `text-shadow` the way CSS does.
 *
 * The engine stores shadows as layers (`{ x, y, blur, spread, color, inset }`) so the inspector can
 * edit them, and a bare string means a shadow token. An agent copying CSS sends
 * `"0 12px 32px -12px rgba(0,0,0,.4)"`, which the engine would read as an unknown token and drop. So
 * specs are translated here, on the way in, into the layers the editor itself would have saved —
 * the saved markup is the same either way, and the engine's own reading of a string stays as it
 * shipped. Text that does not read as shadows is left alone for the validator to name.
 */
final class ShadowText {

	/** Corner order of `border-radius` shorthand, as the engine's corners object names them. */
	private const CORNERS = [ 'topLeft', 'topRight', 'bottomRight', 'bottomLeft' ];

	/** Control → reader. */
	private const CONTROLS = [
		'effects.boxShadow' => 'box',
		'effects.textShadow' => 'text',
	];

	/**
	 * The `blicks` tree with every shadow written as CSS text turned into layers.
	 *
	 * @param array<string, mixed> $blicks
	 * @return array<string, mixed>
	 */
	public static function normalize( array $blicks ): array {
		foreach ( self::CONTROLS as $id => $kind ) {
			if ( ! is_array( $blicks[ $id ] ?? null ) ) {
				continue;
			}

			foreach ( $blicks[ $id ] as $slot => $byBreakpoint ) {
				if ( ! is_array( $byBreakpoint ) ) {
					continue;
				}

				foreach ( $byBreakpoint as $breakpoint => $value ) {
					if ( ! is_string( $value ) || ( 'box' === $kind && Tokens::isToken( 'shadow', trim( $value ) ) ) ) {
						continue;
					}

					$layers = 'box' === $kind ? self::box( $value ) : self::text( $value );

					if ( null !== $layers ) {
						$blicks[ $id ][ $slot ][ $breakpoint ] = $layers;
					}
				}
			}
		}

		return self::radius( $blicks );
	}

	/**
	 * `border.radius` written as CSS shorthand — `"8px 16px"` or the elliptical `"4% / 6%"` — as
	 * the corners object. Copied whole into each corner it is either the wrong shape (two values
	 * a corner) or invalid (`/` is shorthand-only), and the corners render square.
	 *
	 * @param array<string, mixed> $blicks
	 * @return array<string, mixed>
	 */
	private static function radius( array $blicks ): array {
		if ( ! is_array( $blicks['border.radius'] ?? null ) ) {
			return $blicks;
		}

		foreach ( $blicks['border.radius'] as $slot => $byBreakpoint ) {
			foreach ( is_array( $byBreakpoint ) ? $byBreakpoint : [] as $breakpoint => $value ) {
				if ( ! is_string( $value ) || 1 !== preg_match( '/\s|\//', trim( $value ) ) ) {
					continue;
				}

				$halves = array_map( static fn ( string $h ): array => self::split( trim( $h ), ' ' ), explode( '/', $value, 2 ) );
				$across = self::fourWay( $halves[0] );
				$down = isset( $halves[1] ) ? self::fourWay( $halves[1] ) : null;

				if ( null === $across || ( isset( $halves[1] ) && null === $down ) ) {
					continue;
				}

				$corners = [];
				foreach ( self::CORNERS as $i => $corner ) {
					$corners[ $corner ] = null === $down ? $across[ $i ] : $across[ $i ] . ' ' . $down[ $i ];
				}
				$blicks['border.radius'][ $slot ][ $breakpoint ] = $corners;
			}
		}

		return $blicks;
	}

	/**
	 * One to four shorthand values spread to four, as CSS does; null for anything else.
	 *
	 * @param list<string> $v
	 * @return list<string>|null
	 */
	private static function fourWay( array $v ): ?array {
		return match ( count( $v ) ) {
			1 => [ $v[0], $v[0], $v[0], $v[0] ],
			2 => [ $v[0], $v[1], $v[0], $v[1] ],
			3 => [ $v[0], $v[1], $v[2], $v[1] ],
			4 => $v,
			default => null,
		};
	}

	/**
	 * `box-shadow` text as layers, first on top, or null when it does not read as one.
	 *
	 * @return list<array<string, mixed>>|array<string, mixed>|null One layer as an object, several as a list.
	 */
	public static function box( string $css ): ?array {
		$layers = [];

		foreach ( self::split( $css, ',' ) as $text ) {
			$layer = self::layer( $text, true );

			if ( null === $layer ) {
				return null;
			}

			$layers[] = $layer;
		}

		if ( [] === $layers ) {
			return null;
		}

		return 1 === count( $layers ) ? $layers[0] : $layers;
	}

	/**
	 * `text-shadow` text as layers — one as an object, several as a list — or null.
	 *
	 * @return list<array<string, mixed>>|array<string, mixed>|null
	 */
	public static function text( string $css ): ?array {
		$layers = [];

		foreach ( self::split( $css, ',' ) as $text ) {
			$layer = self::layer( $text, false );

			if ( null === $layer ) {
				return null;
			}

			$layers[] = $layer;
		}

		if ( [] === $layers ) {
			return null;
		}

		return 1 === count( $layers ) ? $layers[0] : $layers;
	}

	/**
	 * One layer: two to four lengths (two or three for text), a colour, and `inset` for a box.
	 *
	 * @return array<string, mixed>|null
	 */
	private static function layer( string $text, bool $box ): ?array {
		$lengths = [];
		$colour = [];
		$inset = false;

		foreach ( self::split( $text, ' ' ) as $token ) {
			if ( $box && 'inset' === strtolower( $token ) ) {
				$inset = true;
			} elseif ( 1 === preg_match( '/^-?(\d+\.?\d*|\.\d+)(px|em|rem|%|vw|vh|vmin|vmax|ch)?$/', $token ) || 1 === preg_match( '/^-?(calc|clamp|min|max)\(/i', $token ) ) {
				// A math function is a length in a shadow: `clamp(20px, 4vw, 60px)` as the blur.
				$lengths[] = 1 === preg_match( '/^-?(\d+\.?\d*|\.\d+)$/', $token ) && 0.0 !== (float) $token ? $token . 'px' : $token;
			} else {
				$colour[] = $token;
			}
		}

		$max = $box ? 4 : 3;

		if ( count( $lengths ) < 2 || count( $lengths ) > $max || count( $colour ) > 1 ) {
			return null;
		}

		$layer = [
			'x' => $lengths[0],
			'y' => $lengths[1],
		];

		if ( isset( $lengths[2] ) ) {
			$layer['blur'] = $lengths[2];
		}

		if ( isset( $lengths[3] ) ) {
			$layer['spread'] = $lengths[3];
		}

		if ( [] !== $colour ) {
			$layer['color'] = $colour[0];
		}

		if ( $inset ) {
			$layer['inset'] = true;
		}

		return $layer;
	}

	/**
	 * Split on a separator outside parentheses, so `rgba(0, 0, 0, .4)` stays one token.
	 *
	 * @return list<string>
	 */
	private static function split( string $text, string $separator ): array {
		$parts = [];
		$depth = 0;
		$current = '';

		foreach ( str_split( $text ) as $char ) {
			if ( '(' === $char ) {
				++$depth;
			} elseif ( ')' === $char ) {
				--$depth;
			}

			$isSeparator = ' ' === $separator ? ctype_space( $char ) : $char === $separator;

			if ( 0 === $depth && $isSeparator ) {
				$parts[] = $current;
				$current = '';
				continue;
			}

			$current .= $char;
		}

		$parts[] = $current;

		return array_values( array_filter( array_map( 'trim', $parts ), static fn ( string $p ): bool => '' !== $p ) );
	}
}
