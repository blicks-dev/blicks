<?php
/**
 * Turns a field value into the text a bound block shows.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bound values: the field's value, formatted, or the fallback when there is nothing to show.
 *
 * **Everything out of here is plain text.** A JSON field, an API answer or a post's custom field is
 * never markup: the caller escapes what this returns for the spot it lands in, and a link or image
 * address that is not http(s) or site-relative is dropped here, before escaping has a chance to
 * let `javascript:` through as a harmless-looking string.
 *
 * Mirrored by the editor (`resources/blocks/loop/data.ts`) and held to the same cases in
 * `tests/fixtures/loop-cases.json`.
 */
final class Formatter {

	public const FORMATS = [ 'none', 'upper', 'truncate', 'number', 'currency', 'date', 'prefix', 'suffix', 'join' ];

	/** The attribute kinds a binding can fill. `url` and `image` must be a safe address. */
	public const KINDS = [ 'text', 'url', 'image' ];

	private function __construct() {}

	/**
	 * What a binding shows for one item.
	 *
	 * @param array<string, mixed> $item
	 * @param array<string, mixed> $args The binding's `args`: key, fallback, format, formatArg.
	 * @return array{text: string, from: 'field'|'fallback'}
	 */
	public static function resolve( array $item, array $args, string $kind = 'text' ): array {
		$key = is_string( $args['key'] ?? null ) ? $args['key'] : '';
		$fallback = ItemPipeline::scalar( $args['fallback'] ?? '' );
		$format = is_string( $args['format'] ?? null ) && in_array( $args['format'], self::FORMATS, true ) ? $args['format'] : 'none';
		$arg = ItemPipeline::scalar( $args['formatArg'] ?? '' );
		$value = '' !== $key ? ( $item[ $key ] ?? null ) : null;

		if ( is_array( $value ) && 'join' !== $format && array_is_list( $value ) ) {
			$value = implode( ', ', array_map( [ ItemPipeline::class, 'scalar' ], $value ) );
		}
		if ( is_array( $value ) && ! array_is_list( $value ) ) {
			$value = null;
		}
		if ( null === $value || '' === $value || [] === $value ) {
			return self::fallback( $fallback, $kind );
		}

		$text = self::format( $value, $format, $arg );

		if ( 'url' === $kind || 'image' === $kind ) {
			$text = self::safeUrl( $text );
			if ( '' === $text ) {
				return self::fallback( $fallback, $kind );
			}
		}

		return [
			'text' => $text,
			'from' => 'field',
		];
	}

	/** One value through one format. A format that cannot read the value leaves it as it was. */
	public static function format( mixed $value, string $format, string $arg ): string {
		switch ( $format ) {
			case 'upper':
				return mb_strtoupper( self::text( $value ) );

			case 'truncate':
				$limit = max( 1, (int) ( '' === $arg ? 80 : $arg ) );
				$text = self::text( $value );
				if ( mb_strlen( $text ) <= $limit ) {
					return $text;
				}
				// Cut at the limit, then back to the last whole word, as the editor does.
				return (string) preg_replace( '/\s+\S*$/u', '', mb_substr( $text, 0, $limit ) ) . '…';

			case 'number':
				return is_numeric( $value ) ? number_format( (float) $value, max( 0, min( 6, (int) $arg ) ) ) : self::text( $value );

			case 'currency':
				if ( ! is_numeric( $value ) ) {
					return self::text( $value );
				}
				$number = (float) $value;

				return ( '' === $arg ? '$' : $arg ) . number_format( $number, fmod( $number, 1.0 ) === 0.0 ? 0 : 2 );

			case 'date':
				return self::date( self::text( $value ), 'long' === $arg ? 'j F Y' : 'j M Y' );

			case 'prefix':
				return $arg . self::text( $value );

			case 'suffix':
				return self::text( $value ) . $arg;

			case 'join':
				return is_array( $value ) ? implode( '' === $arg ? ', ' : $arg, array_map( [ ItemPipeline::class, 'scalar' ], $value ) ) : self::text( $value );
		}

		return self::text( $value );
	}

	/** An http(s), site-relative or `#fragment` address, or "" for anything else (`javascript:`, `data:`, `//host`). */
	public static function safeUrl( string $url ): string {
		$url = trim( $url );

		return 1 === preg_match( '~^(https?://[^\s]+|/(?!/)[^\s]*|#[^\s]*)$~i', $url ) ? $url : '';
	}

	/**
	 * The binding's fallback. It comes from post content like the field does, so an address is held
	 * to the same http(s)-or-relative rule: a `javascript:` fallback must not reach an `href`.
	 *
	 * @return array{text: string, from: 'fallback'}
	 */
	private static function fallback( string $text, string $kind ): array {
		return [
			'text' => 'url' === $kind || 'image' === $kind ? self::safeUrl( $text ) : $text,
			'from' => 'fallback',
		];
	}

	private static function text( mixed $value ): string {
		return is_array( $value ) ? implode( ', ', array_map( [ ItemPipeline::class, 'scalar' ], $value ) ) : ItemPipeline::scalar( $value );
	}

	/**
	 * A date in the site's language when WordPress is loaded, else in English. A value that is not
	 * a date is shown as it came.
	 */
	private static function date( string $value, string $format ): string {
		$time = strtotime( $value );
		if ( false === $time ) {
			return $value;
		}

		return function_exists( 'wp_date' ) ? (string) wp_date( $format, $time, new \DateTimeZone( 'UTC' ) ) : gmdate( $format, $time );
	}
}
