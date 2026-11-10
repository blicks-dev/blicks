<?php
/**
 * Reads stored block markup back into specs.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads stored block markup back into specs, so a caller can be shown what a page currently is
 * before being asked to change it.
 *
 * The split between {@see self::fromMarkup()} and {@see self::fromParsedBlocks()} is there so the
 * mapping — the part with rules in it — can be tested without WordPress loaded. `parse_blocks()`
 * is core's, well covered, and not what would break; turning its output into specs is ours.
 *
 * Non-Blicks blocks are kept, not dropped. A page is usually a mix, and a caller that asked for
 * the layout and got only the Blicks parts would rewrite the page with everything else missing.
 * They come back as their stored markup ({@see BlockSpec::isOpaque()}), children and all: this
 * plugin can rebuild only its own blocks, so anything else has to round-trip as the bytes it was.
 */
final class SpecParser {

	/**
	 * Parse post content into specs.
	 *
	 * @return list<BlockSpec>
	 */
	public static function fromMarkup( string $markup ): array {
		if ( ! function_exists( 'parse_blocks' ) ) {
			return [];
		}

		return self::fromParsedBlocks( parse_blocks( $markup ) );
	}

	/**
	 * Map `parse_blocks()` output onto specs.
	 *
	 * @param array<int, array<string, mixed>> $blocks
	 * @return list<BlockSpec>
	 */
	public static function fromParsedBlocks( array $blocks ): array {
		$specs = [];

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			$name = $block['blockName'] ?? null;

			// A null blockName is the whitespace and stray HTML between blocks. It carries no
			// attributes and nothing can be said about it, so it is not a block for our purposes.
			if ( ! is_string( $name ) || '' === $name ) {
				continue;
			}

			if ( ! str_starts_with( $name, 'blicks/' ) ) {
				$specs[] = new BlockSpec( $name, [], [], [], self::markup( $block ) );
				continue;
			}

			$attributes = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
			$blicks = is_array( $attributes['blicks'] ?? null ) ? $attributes['blicks'] : [];
			unset( $attributes['blicks'] );

			$specs[] = new BlockSpec(
				$name,
				$attributes,
				$blicks,
				self::fromParsedBlocks( is_array( $block['innerBlocks'] ?? null ) ? $block['innerBlocks'] : [] )
			);
		}

		return $specs;
	}

	/**
	 * A parsed block back as the markup it was stored as.
	 *
	 * @param array<string, mixed> $block
	 */
	private static function markup( array $block ): string {
		return function_exists( 'serialize_block' ) ? serialize_block( $block ) : '';
	}
}
