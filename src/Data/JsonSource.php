<?php
/**
 * Reads a Loop's items out of JSON.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Error;

/**
 * JSON → a list of items. Used for pasted JSON and, after the fetch, for an endpoint's answer.
 *
 * A Loop does not ask for a path: it offers every list of objects inside the JSON ("data.items · 8
 * items") and stores the one chosen. When that path is gone (the JSON changed) the first list is
 * used, so a Loop keeps showing something sensible instead of nothing.
 */
final class JsonSource {

	/** Pasted JSON lives in post content; past this it belongs behind an endpoint. */
	public const MAX_BYTES = 262144;
	public const MAX_DEPTH = 32;
	/** How deep the list finder looks. Real APIs nest their lists two or three levels down. */
	private const SCAN_DEPTH = 6;

	private function __construct() {}

	/**
	 * Decode JSON with the size and depth caps.
	 *
	 * @return mixed|WP_Error
	 */
	public static function decode( string $json, int $max = self::MAX_BYTES ): mixed {
		if ( '' === trim( $json ) ) {
			return new WP_Error( 'blicks_loop_no_data', __( 'There is no data yet.', 'blicks' ) );
		}
		if ( strlen( $json ) > $max ) {
			return new WP_Error( 'blicks_loop_too_large', __( 'This data is too large for a Loop.', 'blicks' ) );
		}

		$value = json_decode( $json, true, self::MAX_DEPTH );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			return new WP_Error( 'blicks_loop_bad_json', __( 'This is not valid JSON.', 'blicks' ) );
		}

		return $value;
	}

	/**
	 * The items at `$path`, or in the first list found when the path is empty or missing.
	 *
	 * @return array{items: list<array<string, mixed>>, path: string}|WP_Error
	 */
	public static function items( mixed $value, string $path ): array|WP_Error {
		$lists = self::lists( $value );

		if ( [] === $lists ) {
			return new WP_Error( 'blicks_loop_no_list', __( 'No list of items was found. The data needs an array of objects.', 'blicks' ) );
		}

		$chosen = in_array( $path, array_column( $lists, 'path' ), true ) ? $path : $lists[0]['path'];

		return [
			'items' => array_values( (array) self::at( $value, $chosen ) ),
			'path' => $chosen,
		];
	}

	/**
	 * Every list of objects inside a value, in document order, with its dot path and length.
	 *
	 * @return list<array{path: string, count: int}>
	 */
	public static function lists( mixed $value ): array {
		$out = [];
		self::walk( $value, '', 0, $out );

		return $out;
	}

	/** The value at a dot path ("data.items"); "" is the value itself. */
	public static function at( mixed $value, string $path ): mixed {
		if ( '' === $path ) {
			return $value;
		}

		foreach ( explode( '.', $path ) as $key ) {
			if ( ! is_array( $value ) || ! array_key_exists( $key, $value ) ) {
				return null;
			}
			$value = $value[ $key ];
		}

		return $value;
	}

	/** @param list<array{path: string, count: int}> $out */
	private static function walk( mixed $value, string $path, int $depth, array &$out ): void {
		if ( $depth > self::SCAN_DEPTH || ! is_array( $value ) ) {
			return;
		}

		if ( array_is_list( $value ) ) {
			if ( [] !== $value && self::allObjects( $value ) ) {
				$out[] = [
					'path' => $path,
					'count' => count( $value ),
				];
			}
			return;
		}

		foreach ( $value as $key => $child ) {
			self::walk( $child, '' === $path ? (string) $key : $path . '.' . $key, $depth + 1, $out );
		}
	}

	/** @param list<mixed> $list */
	private static function allObjects( array $list ): bool {
		foreach ( $list as $item ) {
			if ( ! is_array( $item ) || ( [] !== $item && array_is_list( $item ) ) ) {
				return false;
			}
		}

		return true;
	}
}
