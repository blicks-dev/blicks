<?php
/**
 * Filters, sorts and slices the items a Loop shows.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * What every source's items go through before they reach the page: one filter rule, an optional
 * sort, then offset and limit.
 *
 * Pure functions over plain arrays, so the same steps run in the editor's TypeScript mirror
 * (`resources/blocks/loop/data.ts`) and both are held to `tests/fixtures/loop-cases.json`. A Loop
 * that shows different items in the editor and on the page is the one bug this block must not
 * have.
 */
final class ItemPipeline {

	/** The most items a Loop renders, whatever its limit says. */
	public const MAX_ITEMS = 50;

	/** Filter and rule operators. Anything else matches nothing. */
	public const OPS = [ 'is', 'not', 'has', 'gt', 'lt', 'set', 'empty' ];

	private function __construct() {}

	/**
	 * Filter, sort and slice.
	 *
	 * @param list<array<string, mixed>> $items
	 * @param array<string, mixed>       $config `filter` {field, op, value}, `sort` {field, dir}, `offset`, `limit`,
	 *                                           and `max`, the cap ({@see self::MAX_ITEMS}; more for pages 1 to N of Load more).
	 * @param bool                       $sliced The source already applied offset and limit (a WordPress query does).
	 * @return array{items: list<array<string, mixed>>, total: int, matched: int}
	 */
	public static function run( array $items, array $config, bool $sliced = false ): array {
		$total = count( $items );
		$filter = is_array( $config['filter'] ?? null ) ? $config['filter'] : [];
		$field = is_string( $filter['field'] ?? null ) ? $filter['field'] : '';

		if ( '' !== $field ) {
			$op = is_string( $filter['op'] ?? null ) ? $filter['op'] : 'is';
			$want = self::scalar( $filter['value'] ?? '' );
			$items = array_values( array_filter( $items, static fn ( array $item ): bool => self::matches( $item[ $field ] ?? null, $op, $want ) ) );
		}

		$matched = count( $items );
		$sort = is_array( $config['sort'] ?? null ) ? $config['sort'] : [];
		$by = is_string( $sort['field'] ?? null ) ? $sort['field'] : '';

		if ( '' !== $by ) {
			$dir = 'desc' === ( $sort['dir'] ?? 'asc' ) ? -1 : 1;
			// usort is not stable for equal keys before PHP 8.0; it is from 8.0, which keeps JSON order for ties.
			usort( $items, static fn ( array $a, array $b ): int => self::compare( $a[ $by ] ?? null, $b[ $by ] ?? null ) * $dir );
		}

		if ( ! $sliced ) {
			$offset = max( 0, (int) ( $config['offset'] ?? 0 ) );
			$limit = (int) ( $config['limit'] ?? 0 );
			$items = array_slice( $items, $offset, $limit > 0 ? $limit : null );
		}

		$max = min( Pager::MAX_STACK, max( 1, (int) ( $config['max'] ?? self::MAX_ITEMS ) ) );

		return [
			'items' => array_slice( $items, 0, $max ),
			'total' => $total,
			'matched' => $matched,
		];
	}

	/**
	 * Whether a value passes one operator. Lists compare as their items joined with ", ", the way
	 * they read on the page; text compares without case. A list is set when it has items, whatever
	 * they hold: a list of objects joins to nothing, and must not read as empty.
	 */
	public static function matches( mixed $value, string $op, string $want ): bool {
		if ( is_array( $value ) && ( 'set' === $op || 'empty' === $op ) ) {
			return ( [] === $value ) === ( 'empty' === $op );
		}

		$text = is_array( $value ) ? implode( ', ', array_map( [ self::class, 'scalar' ], $value ) ) : self::scalar( $value );

		switch ( $op ) {
			case 'is':
				return 0 === strcasecmp( $text, $want );
			case 'not':
				return 0 !== strcasecmp( $text, $want );
			case 'has':
				return '' === $want || false !== mb_stripos( $text, $want );
			case 'gt':
				return is_numeric( $text ) && is_numeric( $want ) && (float) $text > (float) $want;
			case 'lt':
				return is_numeric( $text ) && is_numeric( $want ) && (float) $text < (float) $want;
			case 'set':
				return '' !== $text;
			case 'empty':
				return '' === $text;
		}

		return false;
	}

	/**
	 * Sort order: numbers by value, everything else as text with numbers inside compared
	 * naturally ("Item 2" before "Item 10"). A missing value compares as greater than any other,
	 * so it sorts last ascending and first descending — the same rule as the editor's comparator.
	 */
	public static function compare( mixed $a, mixed $b ): int {
		$a = self::sortable( $a );
		$b = self::sortable( $b );

		if ( null === $a && null === $b ) {
			return 0;
		}
		if ( null === $a ) {
			return 1;
		}
		if ( null === $b ) {
			return -1;
		}
		if ( ( is_int( $a ) || is_float( $a ) ) && ( is_int( $b ) || is_float( $b ) ) ) {
			return $a <=> $b;
		}

		return strnatcasecmp( (string) $a, (string) $b ) <=> 0;
	}

	/**
	 * The fields of the first item, with a type each, for the editor's field list and pickers.
	 *
	 * @param list<array<string, mixed>> $items
	 * @return list<array{key: string, type: string}>
	 */
	public static function fields( array $items ): array {
		$first = $items[0] ?? [];
		$out = [];

		foreach ( $first as $key => $value ) {
			$out[] = [
				'key' => (string) $key,
				'type' => self::typeOf( (string) $key, $value ),
			];
		}

		return $out;
	}

	/** A field's type, guessed from its first value and its name. */
	public static function typeOf( string $key, mixed $value ): string {
		if ( is_array( $value ) ) {
			return array_is_list( $value ) ? 'list' : 'object';
		}
		if ( is_bool( $value ) ) {
			return 'yes/no';
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return 'number';
		}
		if ( is_string( $value ) ) {
			if ( 1 === preg_match( '/\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i', $value ) || 1 === preg_match( '/image|photo|avatar|thumb/i', $key ) ) {
				return 'image';
			}
			if ( 1 === preg_match( '#^(https?:)?//#i', $value ) || str_starts_with( $value, '/' ) || 1 === preg_match( '/url|link|href|profile/i', $key ) ) {
				return 'link';
			}
			if ( 1 === preg_match( '/^\d{4}-\d{2}-\d{2}/', $value ) ) {
				return 'date';
			}
		}

		return 'text';
	}

	/** Any value as the text a comparison or the page sees: booleans as "true"/"false", null as "". */
	public static function scalar( mixed $value ): string {
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( is_int( $value ) || is_float( $value ) || is_string( $value ) ) {
			return (string) $value;
		}

		return '';
	}

	private static function sortable( mixed $value ): int|float|string|null {
		if ( is_int( $value ) || is_float( $value ) ) {
			return $value;
		}
		if ( is_bool( $value ) ) {
			return $value ? 1 : 0;
		}
		if ( is_string( $value ) && '' !== $value ) {
			return $value;
		}
		if ( is_array( $value ) && [] !== $value ) {
			return implode( ', ', array_map( [ self::class, 'scalar' ], $value ) );
		}

		return null;
	}
}
