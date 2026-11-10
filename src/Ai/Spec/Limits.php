<?php
/**
 * Size limits on a layout handed in from outside.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * How big a layout an agent may send.
 *
 * The block editor has no such limits because a person cannot type a forty-thousand-block page.
 * An agent can, by mistake or by loop, and every one of those blocks is validated, serialized and
 * run through KSES inside one PHP request. These bounds sit far above any real page — a long
 * landing page is a few hundred blocks — and well below what would exhaust a request.
 *
 * Checked before anything else, so an oversized payload costs one count, not a validation pass.
 */
final class Limits {

	/** Blocks in one tree, children included. */
	public const MAX_BLOCKS = 500;

	/** Nesting depth. Real layouts are rarely deeper than six. */
	public const MAX_DEPTH = 24;

	/** The tree as JSON, in bytes. */
	public const MAX_BYTES = 524288;

	/**
	 * Every limit the tree breaks, as validator errors. Empty when it is within bounds.
	 *
	 * @param list<mixed> $blocks Raw blocks as decoded from the request.
	 * @return list<array{path: string, message: string, reason: string}>
	 */
	public static function check( array $blocks ): array {
		$encoded = wp_json_encode( $blocks );
		$bytes = is_string( $encoded ) ? strlen( $encoded ) : PHP_INT_MAX;

		if ( $bytes > self::MAX_BYTES ) {
			return [ self::error( sprintf( 'The layout is %d bytes; the limit is %d. Split the change into smaller writes.', $bytes, self::MAX_BYTES ) ) ];
		}

		[ $count, $depth ] = self::measure( $blocks, 1 );

		$errors = [];

		if ( $count > self::MAX_BLOCKS ) {
			$errors[] = self::error( sprintf( 'The layout has %d blocks; the limit is %d.', $count, self::MAX_BLOCKS ) );
		}

		if ( $depth > self::MAX_DEPTH ) {
			$errors[] = self::error( sprintf( 'The layout nests %d levels deep; the limit is %d.', $depth, self::MAX_DEPTH ) );
		}

		return $errors;
	}

	/**
	 * Blocks and depth, stopping early once either is clearly over.
	 *
	 * @param list<mixed> $blocks
	 * @return array{0: int, 1: int}
	 */
	private static function measure( array $blocks, int $level ): array {
		$count = 0;
		$depth = [] === $blocks ? $level - 1 : $level;

		foreach ( $blocks as $block ) {
			++$count;

			if ( $count > self::MAX_BLOCKS || $level > self::MAX_DEPTH ) {
				break;
			}

			$children = is_array( $block ) && is_array( $block['innerBlocks'] ?? null ) ? $block['innerBlocks'] : [];

			if ( [] !== $children ) {
				[ $childCount, $childDepth ] = self::measure( array_values( $children ), $level + 1 );
				$count += $childCount;
				$depth = max( $depth, $childDepth );
			}
		}

		return [ $count, $depth ];
	}

	/** @return array{path: string, message: string, reason: string} */
	private static function error( string $message ): array {
		return [
			'path' => 'blocks',
			'message' => $message,
			'reason' => 'too-large',
		];
	}
}
