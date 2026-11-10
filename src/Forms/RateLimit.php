<?php
/**
 * How often one visitor may send one form.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Five sends a minute per visitor and form, counted in a transient keyed on a salted hash of the
 * address: the address itself is never stored, here or in an entry.
 *
 * The address is `REMOTE_ADDR`. A forwarded header is any client's to write, so it is trusted only
 * when the site says so, through the `blicks_form_client_ip` filter (behind a known proxy).
 */
final class RateLimit {

	public const LIMIT = 5;
	public const WINDOW = MINUTE_IN_SECONDS;

	private const PREFIX = 'blicks_frl_';

	/**
	 * Count one send. False when this visitor has used up the window for this form.
	 *
	 * @param int|null $now The time; the current time when null (tests pass one).
	 */
	public static function hit( string $form, ?int $now = null ): bool {
		$now = $now ?? time();
		$key = self::PREFIX . md5( self::ipHash() . '|' . $form );
		$state = get_transient( $key );
		$start = is_array( $state ) && is_int( $state['start'] ?? null ) ? $state['start'] : 0;
		$count = is_array( $state ) && is_int( $state['count'] ?? null ) ? $state['count'] : 0;

		if ( $now - $start >= self::WINDOW ) {
			$start = $now;
			$count = 0;
		}

		if ( $count >= self::LIMIT ) {
			return false;
		}

		set_transient(
			$key,
			[
				'start' => $start,
				'count' => $count + 1,
			],
			max( 1, self::WINDOW - ( $now - $start ) )
		);

		return true;
	}

	/** The visitor's address, hashed with the site's salt. '' when the address is unknown. */
	public static function ipHash(): string {
		$ip = self::ip();

		return '' !== $ip ? hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) . '|blicks-ip' ) : '';
	}

	/** The visitor's address: REMOTE_ADDR unless filtered, '' when it is not an address. */
	private static function ip(): string {
		$remote = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

		/**
		 * The sending visitor's IP address. Only `REMOTE_ADDR` is read by default; behind a
		 * reverse proxy you trust, return the forwarded address here.
		 *
		 * @param string $remote `REMOTE_ADDR`.
		 */
		$ip = apply_filters( 'blicks_form_client_ip', $remote );

		return is_string( $ip ) && false !== filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '';
	}
}
