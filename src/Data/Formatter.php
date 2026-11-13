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

	/**
	 * `upper`, `prefix` and `suffix` are read for bindings saved before Case and Text before/after;
	 * the Data section writes `case` and the `before`/`after` args instead.
	 */
	public const FORMATS = [ 'none', 'upper', 'case', 'truncate', 'number', 'currency', 'date', 'prefix', 'suffix', 'join' ];

	/** Each format's options (`args.opts`): the values each may take, the first the default. */
	public const OPTS = [
		'case' => [ 'upper', 'lower', 'title' ],
		'cut' => [ 'word', 'char' ],
		'decimals' => [ 'auto', '0', '1', '2' ],
		'group' => [ ',', '.', ' ', '' ],
		'point' => [ '.', ',' ],
		'compact' => [ '', 'yes' ],
		'show' => [ 'symbol', 'code', 'code-after', 'both' ],
		'style' => [ 'short', 'long', 'us', 'dmy', 'mdy', 'iso', 'weekday', 'site', 'custom' ],
	];

	/** Options that take free text rather than one of {@see OPTS}. */
	public const TEXT_OPTS = [ 'currency', 'currencyField', 'pattern' ];

	/** Currency codes → the symbol shown for them. A code not here shows as itself. */
	public const CURRENCY_SYMBOLS = [
		'USD' => '$',
		'EUR' => '€',
		'GBP' => '£',
		'JPY' => '¥',
		'CNY' => '¥',
		'INR' => '₹',
		'NPR' => 'Rs',
		'LKR' => 'Rs',
		'PKR' => 'Rs',
		'BDT' => '৳',
		'AUD' => 'A$',
		'CAD' => 'CA$',
		'NZD' => 'NZ$',
		'HKD' => 'HK$',
		'SGD' => 'S$',
		'MXN' => 'MX$',
		'BRL' => 'R$',
		'ZAR' => 'R',
		'CHF' => 'CHF',
		'SEK' => 'kr',
		'NOK' => 'kr',
		'DKK' => 'kr',
		'PLN' => 'zł',
		'TRY' => '₺',
		'RUB' => '₽',
		'KRW' => '₩',
		'THB' => '฿',
		'VND' => '₫',
		'PHP' => '₱',
		'IDR' => 'Rp',
		'MYR' => 'RM',
		'AED' => 'AED',
		'SAR' => 'SAR',
		'EGP' => 'E£',
		'KES' => 'KSh',
		'NGN' => '₦',
		'ILS' => '₪',
	];

	/** The date styles as date patterns. `site` and `custom` come from elsewhere. */
	public const DATE_STYLES = [
		'short' => 'j M Y',
		'long' => 'j F Y',
		'us' => 'M j, Y',
		'dmy' => 'd/m/Y',
		'mdy' => 'm/d/Y',
		'iso' => 'Y-m-d',
		'weekday' => 'D, j M',
	];

	/** The date letters a pattern may use; the editor reads the same ones. */
	private const DATE_TOKENS = 'djSDlmnMFyY';

	/** The attribute kinds a binding can fill. `url` and `image` must be a safe address. */
	public const KINDS = [ 'text', 'url', 'image' ];

	private function __construct() {}

	/**
	 * What a binding shows for one item.
	 *
	 * @param array<string, mixed> $item
	 * @param array<string, mixed> $args The binding's `args`: key, fallback, format, formatArg, opts,
	 *                                   before, after.
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

		$opts = is_array( $args['opts'] ?? null ) ? $args['opts'] : [];
		$text = ItemPipeline::scalar( $args['before'] ?? '' ) . self::format( $value, $format, $arg, $opts, $item ) . ItemPipeline::scalar( $args['after'] ?? '' );

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

	/**
	 * One value through one format. `$arg` is the single setting saved before options (`formatArg`);
	 * `$opts` are the format's options; `$item` is the whole item, for a currency read from a field.
	 * A format that cannot read the value leaves it as it was.
	 *
	 * @param array<string, mixed> $opts
	 * @param array<string, mixed> $item
	 */
	public static function format( mixed $value, string $format, string $arg, array $opts = [], array $item = [] ): string {
		switch ( $format ) {
			case 'upper':
				return mb_strtoupper( self::text( $value ) );

			case 'case':
				return self::cased( self::text( $value ), self::opt( $opts, 'case' ) );

			case 'truncate':
				$limit = max( 1, (int) ( '' === $arg ? 80 : $arg ) );
				$text = self::text( $value );
				if ( mb_strlen( $text ) <= $limit ) {
					return $text;
				}
				$cut = mb_substr( $text, 0, $limit );
				// Cut at the limit, then back to the last whole word unless told to cut exactly, as the editor does.
				return ( 'char' === self::opt( $opts, 'cut' ) ? $cut : (string) preg_replace( '/\s+\S*$/u', '', $cut ) ) . '…';

			case 'number':
				if ( ! is_numeric( $value ) ) {
					return self::text( $value );
				}
				$number = (float) $value;
				$abs = abs( $number );
				$point = self::opt( $opts, 'point' );
				$short = 'yes' === self::opt( $opts, 'compact' ) ? self::compact( $abs, $point ) : null;
				// No Decimals option: the setting saved before options (0–6), else none.
				$decimals = array_key_exists( 'decimals', $opts ) ? self::places( $abs, self::opt( $opts, 'decimals' ) ) : max( 0, min( 6, (int) $arg ) );

				return ( $number < 0 ? '-' : '' ) . ( $short ?? number_format( $abs, $decimals, $point, self::opt( $opts, 'group' ) ) );

			case 'currency':
				return is_numeric( $value ) ? self::money( (float) $value, $arg, $opts, $item ) : self::text( $value );

			case 'date':
				$style = self::opt( $opts, 'style', 'long' === $arg ? 'long' : 'short' );
				if ( 'site' === $style ) {
					$pattern = function_exists( 'get_option' ) ? (string) get_option( 'date_format', 'F j, Y' ) : 'F j, Y';
				} elseif ( 'custom' === $style ) {
					$pattern = ItemPipeline::scalar( $opts['pattern'] ?? '' );
					$pattern = '' === $pattern ? self::DATE_STYLES['short'] : $pattern;
				} else {
					$pattern = self::DATE_STYLES[ $style ];
				}

				return self::date( self::text( $value ), $pattern );

			case 'prefix':
				return $arg . self::text( $value );

			case 'suffix':
				return self::text( $value ) . $arg;

			case 'join':
				return is_array( $value ) ? implode( '' === $arg ? ', ' : $arg, array_map( [ ItemPipeline::class, 'scalar' ], $value ) ) : self::text( $value );
		}

		return self::text( $value );
	}

	/**
	 * One of an option's allowed values, or its default (the first, or `$fallback` when allowed).
	 *
	 * @param array<string, mixed> $opts
	 */
	private static function opt( array $opts, string $key, ?string $fallback = null ): string {
		$allowed = self::OPTS[ $key ];
		$value = ItemPipeline::scalar( $opts[ $key ] ?? '' );
		if ( array_key_exists( $key, $opts ) && in_array( $value, $allowed, true ) ) {
			return $value;
		}

		return null !== $fallback && in_array( $fallback, $allowed, true ) ? $fallback : $allowed[0];
	}

	/** `auto` decimals: none for a whole number, two otherwise. */
	private static function places( float $number, string $decimals ): int {
		return 'auto' === $decimals ? ( fmod( $number, 1.0 ) === 0.0 ? 0 : 2 ) : (int) $decimals;
	}

	/** 1.2K, 3.4M, 5B: one decimal, dropped when it is 0. Null below a thousand. */
	private static function compact( float $number, string $point ): ?string {
		foreach ( [ [ 1e9, 'B' ], [ 1e6, 'M' ], [ 1e3, 'K' ] ] as [ $size, $unit ] ) {
			if ( $number >= $size ) {
				return (string) preg_replace( '/' . preg_quote( $point, '/' ) . '0$/', '', number_format( $number / $size, 1, $point, '' ) ) . $unit;
			}
		}

		return null;
	}

	/**
	 * A price: the currency from an item field, else typed, else the symbol saved before options,
	 * else US dollars; a three-letter code shows as its symbol, its code, or both.
	 *
	 * @param array<string, mixed> $opts
	 * @param array<string, mixed> $item
	 */
	private static function money( float $number, string $arg, array $opts, array $item ): string {
		$field = ItemPipeline::scalar( $opts['currencyField'] ?? '' );
		$currency = '' !== $field ? trim( ItemPipeline::scalar( $item[ $field ] ?? '' ) ) : '';
		if ( '' === $currency ) {
			$currency = trim( ItemPipeline::scalar( $opts['currency'] ?? '' ) );
		}
		if ( '' === $currency ) {
			$currency = '' === trim( $arg ) ? 'USD' : trim( $arg );
		}

		$isCode = 1 === preg_match( '/^[A-Za-z]{3}$/', $currency );
		$code = $isCode ? strtoupper( $currency ) : $currency;
		$symbol = $isCode ? ( self::CURRENCY_SYMBOLS[ $code ] ?? $code ) : $currency;
		$abs = abs( $number );
		$digits = number_format( $abs, self::places( $abs, self::opt( $opts, 'decimals' ) ), self::opt( $opts, 'point' ), self::opt( $opts, 'group' ) );

		$out = match ( self::opt( $opts, 'show' ) ) {
			'code' => "{$code} {$digits}",
			'code-after' => "{$digits} {$code}",
			'both' => $symbol === $code ? "{$code} {$digits}" : self::glue( $symbol ) . "{$digits} {$code}",
			default => self::glue( $symbol ) . $digits,
		};

		return ( $number < 0 ? '-' : '' ) . $out;
	}

	/** A symbol that ends in a letter (`Rs`, `CHF`) is kept apart from the number. */
	private static function glue( string $symbol ): string {
		return 1 === preg_match( '/\p{L}$/u', $symbol ) ? $symbol . ' ' : $symbol;
	}

	private static function cased( string $text, string $how ): string {
		if ( 'lower' === $how ) {
			return mb_strtolower( $text );
		}
		if ( 'title' === $how ) {
			return (string) preg_replace_callback( '/(^|[\s-])(\p{L})/u', static fn ( array $m ): string => $m[1] . mb_strtoupper( $m[2] ), mb_strtolower( $text ) );
		}

		return mb_strtoupper( $text );
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
	 * A date through a date pattern, in the site's language when WordPress is loaded, else in
	 * English. Only the day, month and year letters are read (`\x` is a literal x); any other letter
	 * is shown as itself, as the editor shows it. A value that is not a date is shown as it came.
	 */
	private static function date( string $value, string $pattern ): string {
		$time = strtotime( $value );
		if ( false === $time ) {
			return $value;
		}

		$safe = '';
		$length = strlen( $pattern );
		for ( $i = 0; $i < $length; $i++ ) {
			$char = $pattern[ $i ];
			if ( '\\' === $char ) {
				$safe .= '\\' . ( $pattern[ ++$i ] ?? '' );
			} elseif ( ctype_alpha( $char ) && ! str_contains( self::DATE_TOKENS, $char ) ) {
				$safe .= '\\' . $char;
			} else {
				$safe .= $char;
			}
		}

		return function_exists( 'wp_date' ) ? (string) wp_date( $safe, $time, new \DateTimeZone( 'UTC' ) ) : gmdate( $safe, $time );
	}
}
