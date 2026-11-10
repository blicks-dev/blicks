<?php
/**
 * The endpoints administrators allow Loops to read.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Models\SettingModel;

/**
 * The site's list of data endpoints, kept in the `blicks_settings` table.
 *
 * **Why a list, not a URL on the block.** Post content can be edited by anyone who can edit the
 * post — in the code editor or over REST — so an "administrators only" rule on a block attribute is
 * no rule at all, and a URL there would let any author make the server fetch any address. Here an
 * administrator adds an endpoint once and a Loop stores only its id. Several Loops then share one
 * cached answer, and no API address ends up in post content.
 *
 * {@see self::check()} is the same refusal list the editor shows before saving; the fetch itself
 * goes through `wp_safe_remote_get`, which checks again after DNS resolution.
 */
final class EndpointRegistry {

	/** Key in the `blicks_settings` table. */
	private const SETTING = 'data.endpoints';

	/** How long an answer is kept, by the names the block and the admin screen use. */
	public const CACHE = [
		'5m' => 300,
		'1h' => 3600,
		'6h' => 21600,
		'1d' => 86400,
	];

	private const MAX_ENDPOINTS = 40;
	private const MAX_NAME = 60;
	private const MAX_URL = 2048;

	private function __construct() {}

	/**
	 * Every endpoint, in the order they were added.
	 *
	 * @return list<array{id: string, name: string, url: string, cache: string, keepLastGood: bool}>
	 */
	public static function all(): array {
		$raw = SettingModel::getValue( self::SETTING, [] );
		$out = [];

		foreach ( is_array( $raw ) ? $raw : [] as $entry ) {
			$clean = is_array( $entry ) ? self::clean( $entry ) : null;
			if ( null !== $clean && '' === self::check( $clean['url'] ) ) {
				$out[] = $clean;
			}
		}

		return $out;
	}

	/** @return array{id: string, name: string, url: string, cache: string, keepLastGood: bool}|null */
	public static function find( string $id ): ?array {
		foreach ( self::all() as $endpoint ) {
			if ( $endpoint['id'] === $id ) {
				return $endpoint;
			}
		}

		return null;
	}

	/**
	 * Add an endpoint, or replace the one with id `$original`.
	 *
	 * @param array<string, mixed> $payload name, url, cache, keepLastGood; id is derived from the name on add.
	 * @return array{ok: bool, errors: array<string, string>, endpoints: list<array<string, mixed>>, id?: string}
	 */
	public static function save( array $payload, string $original = '' ): array {
		$endpoints = self::all();
		$errors = [];

		$name = trim( sanitize_text_field( (string) ( $payload['name'] ?? '' ) ) );
		$url = trim( (string) ( $payload['url'] ?? '' ) );
		$cache = is_string( $payload['cache'] ?? null ) && isset( self::CACHE[ $payload['cache'] ] ) ? $payload['cache'] : '1h';

		if ( '' === $name ) {
			$errors['name'] = __( 'Give the endpoint a name.', 'blicks' );
		} elseif ( mb_strlen( $name ) > self::MAX_NAME ) {
			$errors['name'] = __( 'Keep the name under 60 characters.', 'blicks' );
		}

		$problem = self::check( $url );
		if ( '' === $problem ) {
			// Checked as typed, stored sanitised. An address only esc_url_raw() objects to is refused too.
			$url = esc_url_raw( $url, [ 'https' ] );
			$problem = self::check( $url );
		}
		if ( '' !== $problem ) {
			$errors['url'] = $problem;
		}

		$index = null;
		foreach ( $endpoints as $i => $endpoint ) {
			if ( '' !== $original && $endpoint['id'] === $original ) {
				$index = $i;
			}
		}

		if ( '' !== $original && null === $index ) {
			$errors['id'] = __( 'That endpoint no longer exists.', 'blicks' );
		}
		if ( null === $index && count( $endpoints ) >= self::MAX_ENDPOINTS ) {
			$errors['name'] = __( 'This site already has 40 endpoints. Remove one first.', 'blicks' );
		}

		if ( [] !== $errors ) {
			return [
				'ok' => false,
				'errors' => $errors,
				'endpoints' => $endpoints,
			];
		}

		$id = null !== $index ? $endpoints[ $index ]['id'] : self::uniqueId( $name, $endpoints );
		$entry = [
			'id' => $id,
			'name' => $name,
			'url' => $url,
			'cache' => $cache,
			'keepLastGood' => ! array_key_exists( 'keepLastGood', $payload ) || (bool) $payload['keepLastGood'],
		];

		if ( null !== $index ) {
			$endpoints[ $index ] = $entry;
		} else {
			$endpoints[] = $entry;
		}

		SettingModel::setValue( self::SETTING, $endpoints );

		return [
			'ok' => true,
			'errors' => [],
			'endpoints' => $endpoints,
			'id' => $id,
		];
	}

	/** @return list<array<string, mixed>> What is left. */
	public static function delete( string $id ): array {
		$endpoints = array_values( array_filter( self::all(), static fn ( array $e ): bool => $e['id'] !== $id ) );
		SettingModel::setValue( self::SETTING, $endpoints );

		return $endpoints;
	}

	/**
	 * Why an address cannot be an endpoint, or "" when it can.
	 *
	 * Only https; no user name or password in the address (they end up in logs); no private,
	 * loopback, link-local or `.local`/`.internal` host, so the site cannot be pointed at its own
	 * network. A host name that later resolves to such an address is refused at fetch time by
	 * `wp_safe_remote_get`.
	 */
	public static function check( string $url ): string {
		if ( '' === $url || strlen( $url ) > self::MAX_URL ) {
			return __( 'Enter a full web address, starting with https://.', 'blicks' );
		}

		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return __( 'Enter a full web address, starting with https://.', 'blicks' );
		}
		if ( 'https' !== strtolower( (string) $parts['scheme'] ) ) {
			return __( 'Use an https:// address. Plain http is refused.', 'blicks' );
		}
		if ( isset( $parts['user'] ) || isset( $parts['pass'] ) ) {
			return __( 'Remove the user name and password from the address. Keys in addresses end up in logs.', 'blicks' );
		}

		$host = strtolower( trim( (string) $parts['host'], '[]' ) );

		if ( 'localhost' === $host || str_ends_with( $host, '.localhost' ) || str_ends_with( $host, '.local' ) || str_ends_with( $host, '.internal' ) ) {
			return self::privateMessage();
		}
		if ( false !== filter_var( $host, FILTER_VALIDATE_IP ) && false === filter_var( $host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) ) {
			return self::privateMessage();
		}

		return '';
	}

	private static function privateMessage(): string {
		return __( 'Private and local addresses are blocked, so the site can’t be used to reach its own network.', 'blicks' );
	}

	/**
	 * @param array<string, mixed> $entry
	 * @return array{id: string, name: string, url: string, cache: string, keepLastGood: bool}|null
	 */
	private static function clean( array $entry ): ?array {
		$id = is_string( $entry['id'] ?? null ) ? (string) preg_replace( '/[^a-z0-9-]/', '', $entry['id'] ) : '';
		$url = is_string( $entry['url'] ?? null ) ? $entry['url'] : '';

		if ( '' === $id || '' === $url ) {
			return null;
		}

		return [
			'id' => $id,
			'name' => is_string( $entry['name'] ?? null ) ? $entry['name'] : $id,
			'url' => $url,
			'cache' => is_string( $entry['cache'] ?? null ) && isset( self::CACHE[ $entry['cache'] ] ) ? $entry['cache'] : '1h',
			'keepLastGood' => (bool) ( $entry['keepLastGood'] ?? true ),
		];
	}

	/** @param list<array{id: string}> $endpoints */
	private static function uniqueId( string $name, array $endpoints ): string {
		$base = sanitize_title( $name );
		$base = '' === $base ? 'endpoint' : substr( $base, 0, 40 );
		$taken = array_column( $endpoints, 'id' );
		$id = $base;
		$n = 2;

		while ( in_array( $id, $taken, true ) ) {
			$id = $base . '-' . $n;
			++$n;
		}

		return $id;
	}
}
