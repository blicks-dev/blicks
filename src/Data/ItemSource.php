<?php
/**
 * A Loop's items from a list of the item above it.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * "Comes from: A list of the item above". A Loop inside another Loop's card repeats over one of
 * that card's item's lists: a trip's itinerary, a product's variants, a post's tags.
 *
 * The parent item reaches the inner Loop through block context ({@see LoopRenderer::list()}), so
 * this source reads nothing on its own: no parent, or no list at `path`, is the empty state.
 *
 * A list of objects gives one item per object. A list of plain values (`["Guide", "Permits"]`)
 * gives items `{ value }`, so a card binds `value`. Anything else in the list is skipped.
 */
final class ItemSource {

	/** The source id, among the Loop's built-in ones. */
	public const ID = 'item';

	/** A Loop inside a card inside a card… stops here: three Loops deep at most. */
	public const MAX_DEPTH = 3;

	/** The key a plain value is given as an item. */
	public const VALUE = 'value';

	private function __construct() {}

	/**
	 * The lists the parent item holds, with their lengths, in field order: what the List picker
	 * offers.
	 *
	 * @param array<string, mixed> $parent
	 * @return list<array{path: string, count: int}>
	 */
	public static function lists( array $parent ): array {
		$out = [];
		foreach ( $parent as $key => $value ) {
			if ( is_array( $value ) && [] !== $value && array_is_list( $value ) ) {
				$out[] = [
					'path' => (string) $key,
					'count' => count( $value ),
				];
			}
		}

		return $out;
	}

	/**
	 * The items at `$path` in the parent item; the first list when `$path` is empty.
	 *
	 * @param array<string, mixed>|null $parent
	 * @return array{items: list<array<string, mixed>>, path: string}
	 */
	public static function items( ?array $parent, string $path ): array {
		if ( null === $parent ) {
			return [
				'items' => [],
				'path' => $path,
			];
		}

		if ( '' === $path ) {
			$path = self::lists( $parent )[0]['path'] ?? '';
		}

		$list = '' === $path ? null : JsonSource::at( $parent, $path );
		$items = [];

		if ( is_array( $list ) && array_is_list( $list ) ) {
			foreach ( $list as $entry ) {
				if ( is_array( $entry ) && ! array_is_list( $entry ) ) {
					$items[] = $entry;
				} elseif ( is_scalar( $entry ) ) {
					$items[] = [ self::VALUE => $entry ];
				}
			}
		}

		return [
			'items' => array_slice( $items, 0, ItemPipeline::MAX_ITEMS ),
			'path' => $path,
		];
	}
}
