<?php
/**
 * The send token: what stands in for a nonce on a public form.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A WordPress nonce cannot protect a public form: every logged-out visitor shares one, and a cached
 * page serves it stale. So the page carries no secret, and the browser asks for a token on the first
 * focus inside the form: `base64url( {"f":form,"p":post,"t":issued,"j":id} ) . "." .
 * base64url( hmac-sha256 )`.
 *
 * Signed with `wp_salt( 'nonce' ) . '|blicks-form'`. On send it must be signed, name this form and
 * post, be at least the form's `spam.minSeconds` old (the timing check) and at most two hours, and
 * its id must not have been used before. The id is spent ({@see self::spend()}) only once a send is
 * accepted, so a visitor who corrects a field after a 422 can send again with the same token.
 */
final class Token {

	/** How long a token lives, in seconds. The behaviour refetches one older than 90 minutes. */
	public const MAX_AGE = 2 * HOUR_IN_SECONDS;

	/** A token longer than this is not one of ours; refused before any decoding. */
	private const MAX_LENGTH = 512;

	/** Transient prefix for spent token ids. */
	private const SPENT = 'blicks_ftj_';

	/**
	 * A fresh token for this form on this post.
	 *
	 * @param int|null $now The issue time; the current time when null (tests pass one).
	 * @return array{token: string, expires: int}
	 */
	public static function issue( string $form, int $post, ?int $now = null ): array {
		$now = $now ?? time();
		$json = wp_json_encode(
			[
				'f' => $form,
				'p' => $post,
				't' => $now,
				'j' => bin2hex( random_bytes( 16 ) ),
			]
		);
		$payload = self::encode( is_string( $json ) ? $json : '' );

		return [
			'token' => $payload . '.' . self::encode( self::sign( $payload ) ),
			'expires' => $now + self::MAX_AGE,
		];
	}

	/**
	 * Why a token may not be used for this send, or '' when it may.
	 *
	 * @param int|null $now The check time; the current time when null.
	 * @return string '' | `forged` | `mismatch` | `early` | `expired` | `spent`
	 */
	public static function check( string $token, string $form, int $post, int $minSeconds, ?int $now = null ): string {
		$claims = self::claims( $token );

		if ( null === $claims ) {
			return 'forged';
		}

		if ( ! hash_equals( $claims['f'], $form ) || $claims['p'] !== $post ) {
			return 'mismatch';
		}

		$age = ( $now ?? time() ) - $claims['t'];

		if ( $age < max( 0, $minSeconds ) ) {
			return 'early';
		}

		if ( $age > self::MAX_AGE ) {
			return 'expired';
		}

		if ( false !== get_transient( self::SPENT . md5( $claims['j'] ) ) ) {
			return 'spent';
		}

		return '';
	}

	/**
	 * Mark a checked token as used, until it would have expired anyway.
	 *
	 * @return bool False when it was already spent (a second send racing the first).
	 */
	public static function spend( string $token, ?int $now = null ): bool {
		$claims = self::claims( $token );

		if ( null === $claims ) {
			return false;
		}

		$key = self::SPENT . md5( $claims['j'] );

		if ( false !== get_transient( $key ) ) {
			return false;
		}

		$left = $claims['t'] + self::MAX_AGE - ( $now ?? time() );

		return set_transient( $key, 1, max( 60, $left ) );
	}

	/**
	 * The signed claims of a token, or null when it is malformed or its signature is wrong.
	 *
	 * @return array{f: string, p: int, t: int, j: string}|null
	 */
	private static function claims( string $token ): ?array {
		if ( '' === $token || strlen( $token ) > self::MAX_LENGTH || 1 !== substr_count( $token, '.' ) ) {
			return null;
		}

		[ $payload, $signature ] = explode( '.', $token );

		if ( '' === $payload || ! hash_equals( self::encode( self::sign( $payload ) ), $signature ) ) {
			return null;
		}

		$claims = json_decode( self::decode( $payload ), true );

		if (
			! is_array( $claims )
			|| ! is_string( $claims['f'] ?? null )
			|| ! is_int( $claims['p'] ?? null )
			|| ! is_int( $claims['t'] ?? null )
			|| ! is_string( $claims['j'] ?? null )
			|| 1 !== preg_match( '/^[a-f0-9]{32}$/', $claims['j'] )
		) {
			return null;
		}

		return [
			'f' => $claims['f'],
			'p' => $claims['p'],
			't' => $claims['t'],
			'j' => $claims['j'],
		];
	}

	private static function sign( string $payload ): string {
		return hash_hmac( 'sha256', $payload, wp_salt( 'nonce' ) . '|blicks-form', true );
	}

	private static function encode( string $bytes ): string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- token encoding, not obfuscation.
		return rtrim( strtr( base64_encode( $bytes ), '+/', '-_' ), '=' );
	}

	private static function decode( string $text ): string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- token encoding, not obfuscation.
		$bytes = base64_decode( strtr( $text, '-_', '+/' ), true );

		return is_string( $bytes ) ? $bytes : '';
	}
}
