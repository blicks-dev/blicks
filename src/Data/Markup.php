<?php
/**
 * Finds and edits one element in a block's saved markup.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The small, exact HTML editing {@see Bindings} needs: find an element by tag (and optionally a
 * class), replace what is inside it, or set one attribute.
 *
 * It reads markup Blicks blocks saved themselves — serialised by React and WordPress, so every
 * attribute is double-quoted and `<`, `>`, `&` and `"` inside values are encoded. That is what
 * makes a scanner this small exact rather than approximate. It is not a general HTML parser and
 * is never handed markup from the data: values written in are encoded by the caller.
 *
 * Selectors: `:root` (the first element), `tag`, `tag.class`, or a comma list of those.
 */
final class Markup {

	private const VOID = [ 'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr' ];

	private function __construct() {}

	/**
	 * The first element matching a selector: where its opening tag starts and ends, and its name.
	 *
	 * @return array{start: int, end: int, tag: string}|null
	 */
	public static function find( string $html, string $selector ): ?array {
		$best = null;

		foreach ( explode( ',', $selector ) as $part ) {
			$part = trim( $part );
			if ( '' === $part ) {
				continue;
			}

			[ $tag, $class ] = array_pad( explode( '.', $part, 2 ), 2, '' );
			$name = ':root' === $tag ? '[a-zA-Z][a-zA-Z0-9-]*' : preg_quote( strtolower( $tag ), '/' );

			$offset = 0;
			while ( 1 === preg_match( '/<(' . $name . ')(?=[\s\/>])[^>]*>/i', $html, $m, PREG_OFFSET_CAPTURE, $offset ) ) {
				$opener = $m[0][0];
				$start = $m[0][1];
				$offset = $start + strlen( $opener );

				if ( '' === $class || self::hasClass( $opener, $class ) ) {
					if ( null === $best || $start < $best['start'] ) {
						$best = [
							'start' => $start,
							'end' => $offset,
							'tag' => strtolower( $m[1][0] ),
						];
					}
					break;
				}
			}
		}

		return $best;
	}

	/**
	 * Replace what is inside an element with `$inner` (already encoded). The matching closing tag
	 * is found by counting nested elements of the same name; when it is not in this piece of
	 * markup (a list item whose nested list comes later), everything after the opening tag is
	 * replaced.
	 *
	 * @param array{start: int, end: int, tag: string} $found
	 */
	public static function replaceInner( string $html, array $found, string $inner ): string {
		if ( in_array( $found['tag'], self::VOID, true ) ) {
			return $html;
		}

		$close = self::closing( $html, $found );

		return substr( $html, 0, $found['end'] ) . $inner . ( null === $close ? '' : substr( $html, $close ) );
	}

	/**
	 * Set one attribute on an element's opening tag; an empty value removes it.
	 *
	 * @param array{start: int, end: int, tag: string} $found
	 */
	public static function setAttribute( string $html, array $found, string $name, string $value ): string {
		if ( 1 !== preg_match( '/^[a-z][a-z0-9_:-]*$/', $name ) || str_starts_with( $name, 'on' ) ) {
			return $html;
		}

		$opener = substr( $html, $found['start'], $found['end'] - $found['start'] );
		$pattern = '/\s' . preg_quote( $name, '/' ) . '(="[^"]*")?(?=[\s\/>])/i';
		$encoded = htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );

		if ( '' === $value ) {
			$opener = (string) preg_replace( $pattern, '', $opener, 1 );
		} elseif ( 1 === preg_match( $pattern, $opener ) ) {
			$opener = (string) preg_replace_callback( $pattern, static fn (): string => ' ' . $name . '="' . $encoded . '"', $opener, 1 );
		} else {
			$opener = (string) preg_replace( '/\s*(\/?)>$/', ' ' . $name . '="' . str_replace( [ '\\', '$' ], [ '\\\\', '\$' ], $encoded ) . '"$1>', $opener, 1 );
		}

		return substr( $html, 0, $found['start'] ) . $opener . substr( $html, $found['end'] );
	}

	/**
	 * Where the closing tag of an element starts, or null.
	 *
	 * @param array{start: int, end: int, tag: string} $found
	 */
	private static function closing( string $html, array $found ): ?int {
		$depth = 1;
		$offset = $found['end'];
		$tag = preg_quote( $found['tag'], '/' );

		while ( 1 === preg_match( '/<(\/?)' . $tag . '(?=[\s\/>])[^>]*>/i', $html, $m, PREG_OFFSET_CAPTURE, $offset ) ) {
			$offset = $m[0][1] + strlen( $m[0][0] );

			if ( '/' === $m[1][0] ) {
				--$depth;
				if ( 0 === $depth ) {
					return $m[0][1];
				}
			} elseif ( ! str_ends_with( $m[0][0], '/>' ) ) {
				++$depth;
			}
		}

		return null;
	}

	private static function hasClass( string $opener, string $class ): bool {
		if ( 1 !== preg_match( '/\sclass="([^"]*)"/i', $opener, $m ) ) {
			return false;
		}

		$classes = preg_split( '/\s+/', $m[1] );

		return is_array( $classes ) && in_array( $class, $classes, true );
	}
}
