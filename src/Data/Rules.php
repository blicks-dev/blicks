<?php
/**
 * Card rules: what changes for the items that match.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A rule picks items by a field or by position and changes a few things about their card.
 *
 * The card stays one design: a rule only overrides a tile's size, the card's style, whether a block
 * shows (by the block's uniqueId), the badge colour or the heading size. Rules run top to bottom and a later rule wins
 * where two change the same thing; a rule's tile size beats the bento pattern.
 *
 * Every value a rule can set is a fixed choice, never free CSS: the result becomes a class name on
 * the page, so each list below is also the list of classes the runtime stylesheet defines.
 *
 * Mirrored by the editor and held to `tests/fixtures/loop-cases.json`.
 */
final class Rules {

	/** Action → the values it takes. */
	public const ACTIONS = [
		'size' => [ '1x1', '2x1', '1x2', '2x2', '3x2', '4x1' ],
		'card' => [ 'highlight', 'dark', 'muted' ],
		// A block in the card, by its uniqueId. Checked by pattern in effects(), not by this list.
		'hide' => [],
		'badge' => [ 'brand', 'success', 'warn', 'danger' ],
		'heading' => [ 'lg', 'xl' ],
	];

	public const POSITION_OPS = [ 'is', 'every', 'first' ];

	/** Rules a Loop keeps; more is a sign the card wants a second design, not a twentieth rule. */
	public const MAX_RULES = 12;
	public const MAX_ACTIONS = 6;

	private function __construct() {}

	/**
	 * Everything the rules change for one item.
	 *
	 * @param list<array<string, mixed>> $rules
	 * @param array<string, mixed>       $item
	 * @param int                        $position 1-based, after filtering and sorting.
	 * @param array{0: int, 1: int}      $span     The tile size the layout gives this position.
	 * @return array{span: array{0: int, 1: int}, card: string, hide: list<string>, badge: string, heading: string, rules: list<int>}
	 */
	public static function effects( array $rules, array $item, int $position, array $span = [ 1, 1 ] ): array {
		$fx = [
			'span' => $span,
			'card' => '',
			'hide' => [],
			'badge' => '',
			'heading' => '',
			'rules' => [],
		];

		foreach ( array_slice( $rules, 0, self::MAX_RULES ) as $index => $rule ) {
			if ( ! is_array( $rule ) || ! self::hits( $rule, $item, $position ) ) {
				continue;
			}

			$fx['rules'][] = $index + 1;

			foreach ( array_slice( is_array( $rule['then'] ?? null ) ? $rule['then'] : [], 0, self::MAX_ACTIONS ) as $action ) {
				foreach ( is_array( $action ) ? $action : [] as $type => $value ) {
					$allowed = 'hide' === $type
						? is_string( $value ) && 1 === preg_match( '/^[A-Za-z0-9_-]{1,40}$/', $value )
						: is_string( $type ) && isset( self::ACTIONS[ $type ] ) && in_array( $value, self::ACTIONS[ $type ], true );

					if ( ! $allowed ) {
						continue;
					}
					if ( 'size' === $type ) {
						[ $cols, $rows ] = array_map( 'intval', explode( 'x', $value ) );
						$fx['span'] = [ $cols, $rows ];
					} elseif ( 'hide' === $type ) {
						$fx['hide'][] = $value;
					} else {
						$fx[ $type ] = $value;
					}
				}
			}
		}

		$fx['hide'] = array_values( array_unique( $fx['hide'] ) );

		return $fx;
	}

	/**
	 * Whether a rule's condition holds.
	 *
	 * @param array<string, mixed> $rule
	 * @param array<string, mixed> $item
	 */
	public static function hits( array $rule, array $item, int $position ): bool {
		$when = is_array( $rule['when'] ?? null ) ? $rule['when'] : [];

		if ( isset( $when['position'] ) ) {
			$n = max( 1, (int) ( $when['value'] ?? 1 ) );

			return match ( $when['position'] ) {
				'every' => 0 === $position % $n,
				'first' => $position <= $n,
				'is' => $position === $n,
				default => false,
			};
		}

		$field = is_string( $when['field'] ?? null ) ? $when['field'] : '';
		if ( '' === $field ) {
			return false;
		}

		return ItemPipeline::matches( $item[ $field ] ?? null, is_string( $when['op'] ?? null ) ? $when['op'] : 'is', ItemPipeline::scalar( $when['value'] ?? '' ) );
	}

	/**
	 * The bento pattern's tile for a slot: the pattern in order, repeating, or 1 × 1 past its end
	 * when it does not repeat.
	 *
	 * @param list<string> $tiles `"2x2"`-style sizes.
	 * @return array{0: int, 1: int}
	 */
	public static function slotSpan( array $tiles, int $slot, bool $repeat ): array {
		$tiles = array_values( array_filter( $tiles, static fn ( $t ): bool => is_string( $t ) && 1 === preg_match( '/^[1-4]x[1-3]$/', $t ) ) );

		if ( [] === $tiles || ( $slot >= count( $tiles ) && ! $repeat ) ) {
			return [ 1, 1 ];
		}

		[ $cols, $rows ] = array_map( 'intval', explode( 'x', $tiles[ $slot % count( $tiles ) ] ) );

		return [ $cols, $rows ];
	}
}
