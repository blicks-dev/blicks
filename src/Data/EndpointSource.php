<?php
/**
 * Fetches and caches an endpoint's answer.
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
 * An endpoint's JSON, as a Loop reads it.
 *
 * **Visitors never wait on the API.** An answer is kept for the endpoint's cache time (fresh), and
 * the last good answer for a week after that. When the fresh copy runs out, the page is served
 * from the last good one and a refresh is queued with `wp_schedule_single_event`, so the next
 * visitor gets new data and nobody's page load is the one that calls a slow API. Only a Loop with
 * no answer at all — the first render after an endpoint is added — fetches inline.
 *
 * **When a refresh fails** the last good answer stays in place if the endpoint says to keep it;
 * otherwise the Loop shows its empty state.
 *
 * Fetches go through `wp_safe_remote_get` (it refuses private and loopback addresses after DNS
 * resolution), with an eight-second timeout, at most two redirects, and a one-megabyte cap on the
 * body. Nothing about the request is configurable from a block.
 */
final class EndpointSource {

	/** The WP-Cron hook that refreshes one endpoint in the background. */
	public const REFRESH_HOOK = 'blicks_refresh_endpoint';

	public const TIMEOUT = 8;
	public const MAX_BYTES = 1048576;
	/** Redirects followed, each one checked like the endpoint's own address before it is asked. */
	public const MAX_REDIRECTS = 2;
	/** How long the last good answer is kept once its fresh copy has run out. */
	private const KEEP = 604800;
	/** How long after a failed fetch before a page load may try again inline. */
	private const RETRY_AFTER = 300;

	private function __construct() {}

	/**
	 * The endpoint's decoded answer, from cache when possible.
	 *
	 * @param bool $wait Fetch now when the fresh copy has run out, instead of serving the last good one
	 *                   and refreshing later. The editor's "Refresh now" and the admin's "Test now".
	 * @return array{value: mixed, fetchedAt: int, stale: bool, error: string}|WP_Error
	 */
	public static function read( string $id, bool $wait = false ): array|WP_Error {
		// A Loop that has not picked one yet: not the same as one whose endpoint was deleted.
		if ( '' === $id ) {
			return new WP_Error( 'blicks_loop_endpoint_unset', __( 'Choose an endpoint in the Loop’s Data settings.', 'blicks' ), [ 'status' => 404 ] );
		}

		$endpoint = EndpointRegistry::find( $id );
		if ( null === $endpoint ) {
			return new WP_Error( 'blicks_loop_no_endpoint', __( 'This Loop’s endpoint was removed. Choose another in the Loop’s Data settings.', 'blicks' ), [ 'status' => 404 ] );
		}

		$key = self::key( $endpoint );
		$fresh = get_transient( $key );
		if ( is_array( $fresh ) && array_key_exists( 'value', $fresh ) ) {
			return self::answer( $fresh, false, '' );
		}

		$last = get_transient( $key . '_last' );
		$hasLast = is_array( $last ) && array_key_exists( 'value', $last );

		if ( $hasLast && ! $wait ) {
			self::queueRefresh( $endpoint['id'] );

			return self::answer( $last, true, '' );
		}

		// An API that just failed is not asked again on every page view (or every "Refresh now"):
		// for a few minutes the stored failure is the answer. "Test now" calls refresh() directly.
		$failed = get_transient( $key . '_error' );
		if ( is_array( $failed ) && time() - (int) ( $failed['at'] ?? 0 ) < self::RETRY_AFTER ) {
			$message = (string) ( $failed['message'] ?? '' );

			return $hasLast && $endpoint['keepLastGood']
				? self::answer( $last, true, $message )
				: new WP_Error( 'blicks_loop_recent_failure', $message, [ 'status' => 502 ] );
		}

		$result = self::refresh( $endpoint['id'] );

		if ( ! is_wp_error( $result ) ) {
			return $result;
		}
		if ( $hasLast && $endpoint['keepLastGood'] ) {
			return self::answer( $last, true, $result->get_error_message() );
		}

		return $result;
	}

	/**
	 * Fetch now and store the answer. Also the WP-Cron callback for {@see self::REFRESH_HOOK}.
	 *
	 * @return array{value: mixed, fetchedAt: int, stale: bool, error: string}|WP_Error
	 */
	public static function refresh( string $id ): array|WP_Error {
		$endpoint = EndpointRegistry::find( $id );
		if ( null === $endpoint ) {
			return new WP_Error( 'blicks_loop_no_endpoint', __( 'This Loop’s endpoint was removed. Choose another in the Loop’s Data settings.', 'blicks' ), [ 'status' => 404 ] );
		}

		$key = self::key( $endpoint );
		$value = self::fetch( $endpoint['url'] );
		if ( is_wp_error( $value ) ) {
			// Kept for the Settings list, which says why the last fetch failed without fetching again.
			set_transient(
				$key . '_error',
				[
					'message' => $value->get_error_message(),
					'at' => time(),
				],
				self::KEEP
			);
			// An endpoint that says not to keep old answers goes empty when a refresh fails.
			if ( ! $endpoint['keepLastGood'] ) {
				delete_transient( $key . '_last' );
			}

			return $value;
		}

		$entry = [
			'value' => $value,
			'at' => time(),
		];

		delete_transient( $key . '_error' );
		set_transient( $key, $entry, EndpointRegistry::CACHE[ $endpoint['cache'] ] );
		set_transient( $key . '_last', $entry, EndpointRegistry::CACHE[ $endpoint['cache'] ] + self::KEEP );

		return self::answer( $entry, false, '' );
	}

	/** Drop the cached answers, after an endpoint is edited or removed. */
	public static function forget( array $endpoint ): void {
		$key = self::key( $endpoint );
		delete_transient( $key );
		delete_transient( $key . '_last' );
		delete_transient( $key . '_error' );
	}

	/**
	 * How the endpoint's last fetch went, from what is cached. Never fetches.
	 *
	 * `state` is `fresh` (within its cache time), `stale` (only the last good answer is left),
	 * `failed` (the last fetch failed; `error` says why, `failedAt` when) or `never` (no answer
	 * yet). A failure after a good answer is `failed` too, with `fetchedAt` still set.
	 *
	 * @param array{id: string, url: string} $endpoint
	 * @return array{state: string, fetchedAt: int, failedAt: int, error: string}
	 */
	public static function status( array $endpoint ): array {
		$key = self::key( $endpoint );
		$fresh = get_transient( $key );
		$last = get_transient( $key . '_last' );
		$error = get_transient( $key . '_error' );

		$good = is_array( $fresh ) ? $fresh : ( is_array( $last ) ? $last : null );
		$fetchedAt = null !== $good ? (int) ( $good['at'] ?? 0 ) : 0;
		$failedAt = is_array( $error ) ? (int) ( $error['at'] ?? 0 ) : 0;

		if ( $failedAt > 0 && $failedAt >= $fetchedAt ) {
			$state = 'failed';
		} elseif ( is_array( $fresh ) ) {
			$state = 'fresh';
		} elseif ( is_array( $last ) ) {
			$state = 'stale';
		} else {
			$state = 'never';
		}

		return [
			'state' => $state,
			'fetchedAt' => $fetchedAt,
			'failedAt' => 'failed' === $state ? $failedAt : 0,
			'error' => 'failed' === $state && is_array( $error ) ? (string) ( $error['message'] ?? '' ) : '',
		];
	}

	/**
	 * GET a URL and decode its JSON.
	 *
	 * @return mixed|WP_Error
	 */
	public static function fetch( string $url ): mixed {
		$problem = EndpointRegistry::check( $url );
		if ( '' !== $problem ) {
			return new WP_Error( 'blicks_loop_unsafe_url', $problem, [ 'status' => 400 ] );
		}

		$response = self::get( $url );

		// Redirects are followed here, not by WordPress: core checks a redirect's target with
		// `wp_http_validate_url()`, which allows plain http and, in some supported versions,
		// link-local addresses. Every hop must pass what the endpoint's own address had to.
		$hops = 0;
		while ( ! is_wp_error( $response ) && self::isRedirect( $response ) ) {
			$next = self::location( $response, $url );
			if ( '' === $next ) {
				break; // Nowhere to go: reported below as the status it is.
			}
			if ( $hops >= self::MAX_REDIRECTS ) {
				return new WP_Error( 'blicks_loop_unreachable', __( 'The endpoint redirected too many times.', 'blicks' ), [ 'status' => 502 ] );
			}

			$problem = EndpointRegistry::check( $next );
			if ( '' === $problem && ! self::resolvesPublic( (string) wp_parse_url( $next, PHP_URL_HOST ) ) ) {
				$problem = self::privateMessage();
			}
			if ( '' !== $problem ) {
				return new WP_Error(
					'blicks_loop_unsafe_url',
					/* translators: %s: why the address was refused. */
					sprintf( __( 'The endpoint redirected to an address that is not allowed. %s', 'blicks' ), $problem ),
					[ 'status' => 400 ]
				);
			}

			++$hops;
			$url = $next;
			$response = self::get( $url );
		}

		if ( is_wp_error( $response ) && 'blicks_loop_unsafe_url' === $response->get_error_code() ) {
			return $response;
		}
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'blicks_loop_unreachable', __( 'The endpoint could not be reached, or took longer than 8 seconds.', 'blicks' ), [ 'status' => 502 ] );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( $status < 200 || $status >= 300 ) {
			return new WP_Error(
				'blicks_loop_http_error',
				/* translators: %d: HTTP status code, e.g. 404. */
				sprintf( __( 'The endpoint answered with status %d.', 'blicks' ), $status ),
				[ 'status' => 502 ]
			);
		}

		$body = (string) wp_remote_retrieve_body( $response );
		if ( strlen( $body ) > self::MAX_BYTES ) {
			return new WP_Error( 'blicks_loop_too_large', __( 'The endpoint’s answer is over 1 MB.', 'blicks' ), [ 'status' => 502 ] );
		}

		$value = JsonSource::decode( $body, self::MAX_BYTES );
		if ( is_wp_error( $value ) ) {
			return new WP_Error( 'blicks_loop_bad_json', __( 'The endpoint did not answer with valid JSON.', 'blicks' ), [ 'status' => 502 ] );
		}

		return $value;
	}

	/**
	 * One GET, no redirects followed.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	private static function get( string $url ) {
		// The DNS check runs as the last `pre_http_request` filter, for this request only: after
		// anything that answers the request itself (a test double, a mocking plugin), before
		// WordPress opens a connection.
		add_filter( 'pre_http_request', [ self::class, 'refusePrivateHost' ], PHP_INT_MAX, 3 );
		$response = wp_safe_remote_get(
			$url,
			[
				'timeout' => self::TIMEOUT,
				// Followed by fetch(), one checked hop at a time.
				'redirection' => 0,
				// One byte over the cap, so an answer of exactly the cap is told apart from a cut one.
				'limit_response_size' => self::MAX_BYTES + 1,
				'headers' => [ 'Accept' => 'application/json' ],
				// The version only: the site's address is not the endpoint's business, and the readme
				// promises the request carries nothing about the site.
				'user-agent' => 'Blicks/' . ( defined( 'BLICKS_VERSION' ) ? constant( 'BLICKS_VERSION' ) : 'dev' ),
			]
		);
		remove_filter( 'pre_http_request', [ self::class, 'refusePrivateHost' ], PHP_INT_MAX );

		return $response;
	}

	/** @param array<string, mixed> $response */
	private static function isRedirect( $response ): bool {
		return in_array( (int) wp_remote_retrieve_response_code( $response ), [ 301, 302, 303, 307, 308 ], true );
	}

	/**
	 * Where a redirect points, made absolute against the address that answered; "" when it does
	 * not say.
	 *
	 * @param array<string, mixed> $response
	 */
	private static function location( $response, string $from ): string {
		$location = wp_remote_retrieve_header( $response, 'location' );
		$location = is_array( $location ) ? (string) end( $location ) : (string) $location;
		$location = trim( $location );

		return '' === $location ? '' : (string) \WP_Http::make_absolute_url( $location, $from );
	}

	private static function privateMessage(): string {
		return __( 'Private and local addresses are blocked, so the site can’t be used to reach its own network.', 'blicks' );
	}

	/**
	 * `pre_http_request` callback for {@see self::fetch()}: refuse a host that resolves to a
	 * private address, unless an earlier filter already answered the request.
	 *
	 * @param false|array|WP_Error $pre
	 * @param array<string, mixed> $args
	 * @return false|array|WP_Error
	 */
	public static function refusePrivateHost( $pre, $args, $url ) {
		if ( false !== $pre || self::resolvesPublic( (string) wp_parse_url( (string) $url, PHP_URL_HOST ) ) ) {
			return $pre;
		}

		return new WP_Error( 'blicks_loop_unsafe_url', self::privateMessage(), [ 'status' => 400 ] );
	}

	/**
	 * Does the host resolve only to public addresses?
	 *
	 * `wp_safe_remote_get` refuses loopback and the RFC 1918 ranges after DNS, but not link-local
	 * (169.254.169.254, the cloud metadata service) or carrier-grade NAT, so a host name pointing
	 * there would get through. A host that does not resolve is left to the request, which fails.
	 */
	private static function resolvesPublic( string $host ): bool {
		$host = trim( $host, '[]' );
		if ( '' === $host ) {
			return true;
		}
		// A literal is judged here too: EndpointRegistry::check() does not know carrier-grade NAT.
		if ( false !== filter_var( $host, FILTER_VALIDATE_IP ) ) {
			return self::isPublicIp( $host );
		}

		$ips = gethostbynamel( $host );
		foreach ( false === $ips ? [] : $ips as $ip ) {
			if ( ! self::isPublicIp( $ip ) ) {
				return false;
			}
		}

		return true;
	}

	/** Not private, reserved (loopback, link-local) or carrier-grade NAT (100.64.0.0/10). */
	private static function isPublicIp( string $ip ): bool {
		$second = (int) ( explode( '.', $ip )[1] ?? 0 );
		if ( str_starts_with( $ip, '100.' ) && $second >= 64 && $second <= 127 ) {
			return false;
		}

		return false !== filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE );
	}

	/** One refresh per endpoint at a time: a queued one is not queued again. */
	private static function queueRefresh( string $id ): void {
		if ( function_exists( 'wp_next_scheduled' ) && false === wp_next_scheduled( self::REFRESH_HOOK, [ $id ] ) ) {
			wp_schedule_single_event( time(), self::REFRESH_HOOK, [ $id ] );
		}
	}

	/** The cache key: the endpoint and its address, so editing the address starts a new cache. */
	private static function key( array $endpoint ): string {
		return 'blicks_ep_' . md5( $endpoint['id'] . '|' . $endpoint['url'] );
	}

	/**
	 * @param array<string, mixed> $entry
	 * @return array{value: mixed, fetchedAt: int, stale: bool, error: string}
	 */
	private static function answer( array $entry, bool $stale, string $error ): array {
		return [
			'value' => $entry['value'],
			'fetchedAt' => (int) ( $entry['at'] ?? 0 ),
			'stale' => $stale,
			'error' => $error,
		];
	}
}
