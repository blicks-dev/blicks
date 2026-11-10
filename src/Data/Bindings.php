<?php
/**
 * Writes an item's values into the blocks of a Loop's card.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One item → one copy of the card's parsed blocks with its bound values written in.
 *
 * **Why the parsed blocks, not the rendered page.** Blicks blocks are static: what they print is
 * the markup they saved, which `parse_blocks()` already hands over in `innerContent`. So the Loop
 * rewrites that saved markup for each item before rendering it, and every render filter (scoped
 * CSS, list markers, the Box link) still runs on the result. No block re-serialises itself, no
 * global filter has to recognise "inside a Loop", and blocks need no new context.
 *
 * **Where a value goes** is declared on the attribute in the block's own block.json, so the place
 * and the markup stay side by side:
 * `"content": { "type": "string", "bindable": { "selector": ":root" } }` — the block's outer
 * element; `"url": { "bindable": { "selector": "img", "attribute": "src", "kind": "image" } }` — an
 * attribute of a tag inside it. `kind` is `text` (default), `url` or `image`; `onlyIf` limits a
 * binding to one shape of the block (a Box's text exists only when it is a badge).
 *
 * **Escaping.** Text is written as text (`&`, `<`, quotes encoded), never markup. Addresses have
 * already been narrowed to http(s) or site-relative by {@see Formatter::resolve()}. An image whose
 * address resolves to nothing is dropped rather than printed with an empty `src`.
 */
final class Bindings {

	/** The binding source a Loop's items answer to, in `metadata.bindings`. */
	public const SOURCE = 'blicks/item';

	private function __construct() {}

	/**
	 * A copy of `$blocks` for one item: bound values written in, hidden blocks removed.
	 *
	 * @param list<array<string, mixed>> $blocks   Parsed blocks (the Loop's inner blocks).
	 * @param array<string, mixed>       $item
	 * @param callable                   $bindable fn( string $blockName ): array<string, array> — attribute → its `bindable` spec.
	 * @param list<string>               $hide     uniqueIds of blocks to leave out for this item.
	 * @return list<array<string, mixed>>
	 */
	public static function apply( array $blocks, array $item, callable $bindable, array $hide = [] ): array {
		$out = [];

		foreach ( $blocks as $block ) {
			$block = self::block( $block, $item, $bindable, $hide );
			if ( null !== $block ) {
				$out[] = $block;
			}
		}

		return $out;
	}

	/**
	 * @param array<string, mixed> $block
	 * @param array<string, mixed> $item
	 * @param list<string>         $hide
	 * @return array<string, mixed>|null Null when the block is hidden or has nothing to show.
	 */
	private static function block( array $block, array $item, callable $bindable, array $hide ): ?array {
		$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
		$id = is_string( $attrs['uniqueId'] ?? null ) ? $attrs['uniqueId'] : '';

		if ( '' !== $id && in_array( $id, $hide, true ) ) {
			return null;
		}

		$bindings = is_array( $attrs['metadata']['bindings'] ?? null ) ? $attrs['metadata']['bindings'] : [];
		$specs = [] === $bindings ? [] : (array) $bindable( (string) ( $block['blockName'] ?? '' ) );

		foreach ( $bindings as $attr => $binding ) {
			$spec = is_array( $specs[ $attr ] ?? null ) ? $specs[ $attr ] : null;

			if ( null === $spec || ! is_array( $binding ) || self::SOURCE !== ( $binding['source'] ?? '' ) || ! self::applies( $spec, $attrs ) ) {
				continue;
			}

			$kind = in_array( $spec['kind'] ?? 'text', Formatter::KINDS, true ) ? $spec['kind'] ?? 'text' : 'text';
			$value = Formatter::resolve( $item, is_array( $binding['args'] ?? null ) ? $binding['args'] : [], $kind )['text'];

			if ( 'image' === $kind && '' === $value ) {
				return null;
			}

			$attrs[ $attr ] = $value;
			$block['innerContent'] = self::write( is_array( $block['innerContent'] ?? null ) ? $block['innerContent'] : [], $spec, $value );
		}

		$block['attrs'] = $attrs;

		$inner = is_array( $block['innerBlocks'] ?? null ) ? $block['innerBlocks'] : [];
		if ( [] !== $inner ) {
			[ $block['innerBlocks'], $block['innerContent'] ] = self::children( $inner, is_array( $block['innerContent'] ?? null ) ? $block['innerContent'] : [], $item, $bindable, $hide );
		}

		$block['innerHTML'] = implode( '', array_filter( $block['innerContent'] ?? [], 'is_string' ) );

		return $block;
	}

	/**
	 * The children for one item, and `innerContent` with the slot of every removed child taken out
	 * (each child is a `null` in `innerContent`, in order).
	 *
	 * @param list<array<string, mixed>> $inner
	 * @param list<string|null>          $content
	 * @param array<string, mixed>       $item
	 * @param list<string>               $hide
	 * @return array{0: list<array<string, mixed>>, 1: list<string|null>}
	 */
	private static function children( array $inner, array $content, array $item, callable $bindable, array $hide ): array {
		$blocks = [];
		$chunks = [];
		$child = 0;

		foreach ( $content as $chunk ) {
			if ( null !== $chunk ) {
				$chunks[] = $chunk;
				continue;
			}

			$kept = isset( $inner[ $child ] ) ? self::block( $inner[ $child ], $item, $bindable, $hide ) : null;
			++$child;

			if ( null !== $kept ) {
				$blocks[] = $kept;
				$chunks[] = null;
			}
		}

		return [ $blocks, $chunks ];
	}

	/**
	 * Whether a spec's `onlyIf` holds for these attributes.
	 *
	 * @param array<string, mixed> $spec
	 * @param array<string, mixed> $attrs
	 */
	private static function applies( array $spec, array $attrs ): bool {
		foreach ( is_array( $spec['onlyIf'] ?? null ) ? $spec['onlyIf'] : [] as $key => $want ) {
			if ( ( $attrs[ $key ] ?? null ) !== $want ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Write a value into the first chunk of saved markup that holds the spec's element.
	 *
	 * @param list<string|null>    $content
	 * @param array<string, mixed> $spec
	 * @return list<string|null>
	 */
	private static function write( array $content, array $spec, string $value ): array {
		$selector = is_string( $spec['selector'] ?? null ) ? $spec['selector'] : ':root';
		$attribute = is_string( $spec['attribute'] ?? null ) ? strtolower( $spec['attribute'] ) : '';

		foreach ( $content as $i => $chunk ) {
			if ( ! is_string( $chunk ) ) {
				continue;
			}

			$found = Markup::find( $chunk, $selector );
			if ( null === $found ) {
				continue;
			}

			if ( '' === $attribute ) {
				$content[ $i ] = Markup::replaceInner( $chunk, $found, htmlspecialchars( $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' ) );

				return $content;
			}

			$chunk = Markup::setAttribute( $chunk, $found, $attribute, $value );

			// A new picture: the template's responsive sources would otherwise win over `src`.
			if ( 'src' === $attribute ) {
				foreach ( [ 'srcset', 'sizes' ] as $stale ) {
					$again = Markup::find( $chunk, $selector );
					$chunk = null === $again ? $chunk : Markup::setAttribute( $chunk, $again, $stale, '' );
				}
			}

			$content[ $i ] = $chunk;

			return $content;
		}

		return $content;
	}
}
