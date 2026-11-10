<?php
/**
 * Talks to the Blicks marketplace on behalf of the Studio.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Marketplace;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Settings\AdminSettings;
use WP_Error;

/**
 * The server side of the Studio library's Marketplace shelf.
 *
 * **Why a proxy, not a fetch from the browser.** Pro items need a licence key, and the key must never
 * reach JavaScript (the Licence screen only ever shows it masked). So the request goes through this
 * site: the Studio asks here, this asks the marketplace, and Blicks Pro adds the key server-side
 * through `blicks_marketplace_request_headers`. Same origin also means no CORS, and one place to
 * cache.
 *
 * **Caching.** Lists (items, terms) are cached for five minutes and the last good answer is kept for
 * a week, so a marketplace outage shows yesterday's shelf, marked stale, instead of an empty one.
 * Content is never cached: Pro markup must not outlive the licence that fetched it, and each fetch
 * counts an install.
 *
 * Only reached when someone opens the Studio library — nothing here runs on page loads.
 *
 * **Off until an administrator turns it on** (Blicks → Settings → Marketplace). While it is off,
 * every route here refuses before a cache read or a request, so no request leaves the site.
 */
final class Client {

	public const DEFAULT_URL = 'https://showcase.blicks.dev/wp-json/blicks-marketplace/v1';

	/** Five minutes. */
	private const FRESH = 300;
	/** A week. */
	private const KEEP = 604800;
	private const TIMEOUT = 8;

	/** List filters passed through to the marketplace; anything else is dropped. */
	public const LIST_PARAMS = [ 'search', 'type', 'group', 'collection', 'industry', 'tag', 'motion', 'tier', 'page', 'per_page', 'orderby', 'order' ];

	/** Whether the shelf may talk to the marketplace: an administrator turned it on in Settings. */
	public static function enabled(): bool {
		return AdminSettings::marketplaceEnabled();
	}

	/** The refusal every route gives while the shelf is off. */
	public static function off(): WP_Error {
		return new WP_Error(
			'blicks_marketplace_off',
			__( 'The Marketplace is off. An administrator can turn it on in Blicks → Settings.', 'blicks' ),
			[ 'status' => 403 ]
		);
	}

	/** The marketplace's API root: showcase.blicks.dev unless the site points elsewhere. */
	public static function base(): string {
		$url = defined( 'BLICKS_MARKETPLACE_URL' ) ? (string) constant( 'BLICKS_MARKETPLACE_URL' ) : self::DEFAULT_URL;

		return untrailingslashit( $url );
	}

	/**
	 * A full URL for a route under the API root. A root given as `…/?rest_route=/ns/v1` (a site
	 * without pretty permalinks) takes the path inside the query and the rest after `&`.
	 *
	 * @param array<string, scalar> $query
	 */
	public static function url( string $base, string $path, array $query = [] ): string {
		$joined = $base . '/' . ltrim( $path, '/' );
		$params = http_build_query( $query, '', '&', PHP_QUERY_RFC3986 );

		if ( '' === $params ) {
			return $joined;
		}

		return $joined . ( str_contains( $joined, '?' ) ? '&' : '?' ) . $params;
	}

	/**
	 * The list filters a caller may pass, cleaned to scalars, with `built=1` always on: the shelf
	 * lists only what a Studio can open.
	 *
	 * @param array<string, mixed> $raw
	 * @return array<string, scalar>
	 */
	public static function listQuery( array $raw ): array {
		$query = [];

		foreach ( self::LIST_PARAMS as $name ) {
			$value = $raw[ $name ] ?? null;

			if ( is_scalar( $value ) && '' !== (string) $value ) {
				$query[ $name ] = sanitize_text_field( (string) $value );
			}
		}

		ksort( $query );

		return $query + [ 'built' => 1 ];
	}

	/**
	 * Whether this site may open Pro items, as Blicks Pro reports it. False without Pro.
	 */
	public static function licensed(): bool {
		return (bool) apply_filters( 'blicks_marketplace_licensed', false );
	}

	/**
	 * A cached list route (`items`, `terms`): fresh for five minutes, else the marketplace, else the
	 * last good answer marked with when it was fetched.
	 *
	 * @param array<string, scalar> $query
	 * @return array<string, mixed>|WP_Error
	 */
	public static function list( string $path, array $query ): array|WP_Error {
		if ( ! self::enabled() ) {
			return self::off();
		}

		$url = self::url( self::base(), $path, $query );
		$key = 'blicks_mkt_' . md5( $url . '|' . ( self::licensed() ? 'pro' : 'free' ) );

		$fresh = get_transient( $key );
		if ( is_array( $fresh ) ) {
			return $fresh + [ 'stale' => null ];
		}

		$body = self::get( $url );

		if ( ! is_wp_error( $body ) ) {
			set_transient( $key, $body, self::FRESH );
			set_transient(
				$key . '_last',
				[
					'at' => time(),
					'body' => $body,
				],
				self::KEEP
			);

			return $body + [ 'stale' => null ];
		}

		$last = get_transient( $key . '_last' );
		if ( is_array( $last ) && is_array( $last['body'] ?? null ) ) {
			return $last['body'] + [ 'stale' => gmdate( 'c', (int) $last['at'] ) ];
		}

		return $body;
	}

	/**
	 * One item's markup and keyframes. Never cached; the marketplace's own refusal (licence
	 * missing or invalid, not built yet) is passed on with its status.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public static function content( string $slug ): array|WP_Error {
		if ( ! self::enabled() ) {
			return self::off();
		}

		return self::get( self::url( self::base(), 'items/' . rawurlencode( $slug ) . '/content' ) );
	}

	/**
	 * GET a URL and decode its JSON, or a WP_Error carrying the marketplace's own message and status.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function get( string $url ): array|WP_Error {
		if ( ! self::enabled() ) {
			return self::off();
		}

		$args = [
			'timeout' => self::TIMEOUT,
			'headers' => self::headers(),
		];

		// The default address goes through the safe API. A site that set its own (a staging
		// marketplace, a local one in development) chose that host deliberately.
		$response = defined( 'BLICKS_MARKETPLACE_URL' ) ? wp_remote_get( $url, $args ) : wp_safe_remote_get( $url, $args );

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'blicks_marketplace_unreachable', __( 'Can’t reach the marketplace right now.', 'blicks' ), [ 'status' => 502 ] );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( $status >= 200 && $status < 300 && is_array( $body ) ) {
			return $body;
		}

		$code = is_array( $body ) && is_string( $body['code'] ?? null ) ? $body['code'] : 'blicks_marketplace_error';
		$message = is_array( $body ) && is_string( $body['message'] ?? null ) ? $body['message'] : __( 'The marketplace could not answer.', 'blicks' );

		return new WP_Error( sanitize_key( $code ), sanitize_text_field( $message ), [ 'status' => $status >= 400 ? $status : 502 ] );
	}

	/**
	 * Request headers from Blicks Pro (its licence), limited to the marketplace's own `X-Blicks-*`
	 * names so a filter cannot turn this into a general-purpose request forger.
	 *
	 * @return array<string, string>
	 */
	public static function headers(): array {
		$headers = apply_filters( 'blicks_marketplace_request_headers', [] );
		$out = [ 'Accept' => 'application/json' ];

		foreach ( is_array( $headers ) ? $headers : [] as $name => $value ) {
			if ( is_string( $name ) && 1 === preg_match( '/^X-Blicks-[A-Za-z-]+$/', $name ) && is_scalar( $value ) ) {
				$out[ $name ] = preg_replace( '/[\r\n]/', '', (string) $value );
			}
		}

		return $out;
	}
}
