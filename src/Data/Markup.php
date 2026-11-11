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
 * Tags and attributes are read by core's HTML tag processor ({@see TagCursor}), never by a pattern
 * over the raw text: the markup comes from post content, and a pattern that tests attribute names
 * cannot tell `alt` the attribute from `alt` the word inside `class="pic alt z"`. A value written
 * in is encoded by the processor, so it can only ever be one attribute's value.
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
			$query = [];

			if ( ':root' !== $tag ) {
				if ( 1 !== preg_match( '/^[a-z][a-z0-9-]*$/i', $tag ) ) {
					continue;
				}
				$query['tag_name'] = $tag;
			}
			if ( '' !== $class ) {
				$query['class_name'] = $class;
			}

			$cursor = new TagCursor( $html );
			if ( ! $cursor->next_tag( $query ) ) {
				continue;
			}

			$span = $cursor->span();
			if ( null !== $span && ( null === $best || $span['start'] < $best['start'] ) ) {
				$best = [
					'start' => $span['start'],
					'end' => $span['start'] + $span['length'],
					'tag' => strtolower( (string) $cursor->get_tag() ),
				];
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
	 * The existing attribute is replaced in place however it was written (double-, single- or
	 * unquoted, or bare), and never duplicated. `$value` is raw text: the processor encodes it,
	 * and runs `esc_url()` on it for an address attribute (`href`, `src`). A value that encoding
	 * empties removes the attribute rather than leaving the template's.
	 *
	 * @param array{start: int, end: int, tag: string} $found
	 */
	public static function setAttribute( string $html, array $found, string $name, string $value ): string {
		if ( 1 !== preg_match( '/^[a-z][a-z0-9_:-]*$/', $name ) || str_starts_with( $name, 'on' ) ) {
			return $html;
		}

		$cursor = new TagCursor( $html );
		if ( ! $cursor->openerAt( $found['start'] ) ) {
			return $html;
		}

		if ( '' === $value || ! $cursor->set_attribute( $name, $value ) ) {
			$cursor->remove_attribute( $name );
		}

		return $cursor->get_updated_html();
	}

	/**
	 * Where the closing tag of an element starts, or null.
	 *
	 * @param array{start: int, end: int, tag: string} $found
	 */
	private static function closing( string $html, array $found ): ?int {
		$cursor = new TagCursor( $html );
		if ( ! $cursor->openerAt( $found['start'] ) ) {
			return null;
		}

		$depth = 1;
		$query = [
			'tag_name' => $found['tag'],
			'tag_closers' => 'visit',
		];

		while ( $cursor->next_tag( $query ) ) {
			if ( $cursor->is_tag_closer() ) {
				--$depth;
				if ( 0 === $depth ) {
					return $cursor->span()['start'] ?? null;
				}
			} elseif ( ! $cursor->has_self_closing_flag() ) {
				++$depth;
			}
		}

		return null;
	}
}
