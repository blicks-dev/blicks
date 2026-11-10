<?php
/**
 * Spam challenges: reCAPTCHA v3, reCAPTCHA v2, Cloudflare Turnstile.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A challenge is a third-party service the site owner opts into, per Form, with keys set once in
 * Blicks › Settings › Forms. Off by default. The secret keys never leave the server.
 *
 * Signatures are part of the Form contract (docs/blicks/plans/form-contracts.md).
 *
 * Nothing here ever blocks a real visitor because of the provider: when the keys are missing or
 * wrong, or the provider cannot be reached, the answer is `unchecked` and the entry is kept with a
 * note. Only a response the provider itself rejects, or one that fails the hostname, action or score
 * checks, is `fail`.
 */
final class Challenge {

	/** The option holding the keys: `[ kind => [ siteKey, secret ] ]`, plus `minScore`. */
	public const OPTION = 'blicks_form_keys';

	/** The kinds a Form may pick besides `none`. */
	public const KINDS = [ 'recaptcha-v3', 'recaptcha-v2', 'turnstile' ];

	/** The reCAPTCHA v3 action name the behaviour executes with. */
	public const ACTION = 'blicks_form';

	/** The v3 score threshold when neither the Form nor the settings say otherwise. */
	public const DEFAULT_MIN_SCORE = 0.5;

	private const VERIFY_URLS = [
		'recaptcha-v3' => 'https://www.google.com/recaptcha/api/siteverify',
		'recaptcha-v2' => 'https://www.google.com/recaptcha/api/siteverify',
		'turnstile' => 'https://challenges.cloudflare.com/turnstile/v0/siteverify', // phpcs:ignore PluginCheck.CodeAnalysis.Offloading.OffloadedContent -- a server-side verification API the site posts to, not an asset; disclosed under External Services.
	];

	/**
	 * Provider error codes that mean the site's own setup or the provider is at fault, not the
	 * visitor: the entry is kept as `unchecked` rather than marked spam.
	 */
	private const SETUP_ERRORS = [ 'missing-input-secret', 'invalid-input-secret', 'internal-error', 'bad-request' ];

	/** @return array<string, array{siteKey: string, secret: string}> */
	public static function keys(): array {
		$stored = get_option( self::OPTION, [] );
		$keys = [];

		foreach ( self::KINDS as $kind ) {
			$pair = is_array( $stored ) && is_array( $stored[ $kind ] ?? null ) ? $stored[ $kind ] : [];
			$keys[ $kind ] = [
				'siteKey' => is_string( $pair['siteKey'] ?? null ) ? $pair['siteKey'] : '',
				'secret' => is_string( $pair['secret'] ?? null ) ? $pair['secret'] : '',
			];
		}

		return $keys;
	}

	/** The site-wide v3 score threshold set in Settings › Forms (0–1). */
	public static function minScore(): float {
		$stored = get_option( self::OPTION, [] );
		$score = is_array( $stored ) && is_numeric( $stored['minScore'] ?? null ) ? (float) $stored['minScore'] : self::DEFAULT_MIN_SCORE;

		return self::clampScore( $score );
	}

	/** A score threshold held to 0–1, two decimals. */
	public static function clampScore( float $score ): float {
		return round( max( 0.0, min( 1.0, $score ) ), 2 );
	}

	/** True when a Form may use this challenge: a known kind with both keys set. */
	public static function configured( string $kind ): bool {
		$keys = self::keys()[ $kind ] ?? null;

		return null !== $keys && '' !== $keys['siteKey'] && '' !== $keys['secret'];
	}

	/** The public site key, '' when not configured. */
	public static function siteKey( string $kind ): string {
		return self::configured( $kind ) ? self::keys()[ $kind ]['siteKey'] : '';
	}

	/**
	 * Load the provider's script on this page, and only this page.
	 *
	 * Called by the Form's renderer for a form that uses the challenge, so the script is never
	 * loaded site-wide. Both reCAPTCHA kinds share one handle: Google's script loaded for v3
	 * (`render=<siteKey>`) can also render v2 widgets explicitly, so when a page holds both, the
	 * v3 address wins.
	 */
	public static function enqueue( string $kind ): void {
		if ( ! self::configured( $kind ) ) {
			return;
		}

		$args = [
			'in_footer' => true,
			'strategy' => 'defer',
		];

		if ( 'turnstile' === $kind ) {
			wp_enqueue_script( 'blicks-turnstile', 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', [], null, $args ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion, PluginCheck.CodeAnalysis.EnqueuedResourceOffloading.OffloadedContent -- the provider's live script, which Turnstile requires be loaded from Cloudflare; enqueued only once an administrator adds Turnstile keys, and disclosed under External Services. A version would only break its cache.

			return;
		}

		$handle = 'blicks-recaptcha';

		if ( 'recaptcha-v3' === $kind ) {
			$src = add_query_arg( 'render', rawurlencode( self::siteKey( $kind ) ), 'https://www.google.com/recaptcha/api.js' );

			// A v2 form earlier on the page registered the explicit-only address; v3 needs its key.
			$registered = wp_scripts()->query( $handle, 'registered' );
			if ( $registered instanceof \_WP_Dependency && $registered->src !== $src && ! wp_script_is( $handle, 'done' ) ) {
				wp_deregister_script( $handle );
			}
		} elseif ( wp_script_is( $handle, 'registered' ) ) {
			wp_enqueue_script( $handle );

			return;
		} else {
			$src = 'https://www.google.com/recaptcha/api.js?render=explicit';
		}

		wp_enqueue_script( $handle, $src, [], null, $args ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- the provider's live script; a version would only break its cache.
	}

	/**
	 * Check a challenge response with the provider.
	 *
	 * The visitor's IP address is not sent (`remoteip` is optional for both providers).
	 *
	 * @return array{result: string, score?: float, note?: string} `pass`, `fail`, or `unchecked`
	 *         (not configured, or the provider could not be reached: the entry is kept).
	 */
	public static function verify( string $kind, string $token, float $minScore ): array {
		if ( ! self::configured( $kind ) ) {
			return self::unchecked();
		}

		$token = trim( $token );
		if ( '' === $token ) {
			return [
				'result' => 'fail',
				'note' => 'Challenge missing',
			];
		}

		$response = wp_remote_post(
			self::VERIFY_URLS[ $kind ],
			[
				'timeout' => 5,
				'redirection' => 0,
				'body' => [
					'secret' => self::keys()[ $kind ]['secret'],
					'response' => $token,
				],
			]
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return self::unchecked();
		}

		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) || ! array_key_exists( 'success', $body ) ) {
			return self::unchecked();
		}

		$score = isset( $body['score'] ) && is_numeric( $body['score'] ) ? (float) $body['score'] : null;
		$withScore = static fn ( array $result ): array => null === $score ? $result : $result + [ 'score' => $score ];

		if ( true !== $body['success'] ) {
			$codes = is_array( $body['error-codes'] ?? null ) ? array_filter( $body['error-codes'], 'is_string' ) : [];

			if ( [] !== array_intersect( $codes, self::SETUP_ERRORS ) ) {
				return self::unchecked();
			}

			return $withScore(
				[
					'result' => 'fail',
					'note' => 'Challenge failed',
				]
			);
		}

		$hostname = is_string( $body['hostname'] ?? null ) ? strtolower( $body['hostname'] ) : '';
		$home = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
		if ( '' !== $hostname && '' !== $home && $hostname !== $home ) {
			return $withScore(
				[
					'result' => 'fail',
					'note' => 'Challenge from another site',
				]
			);
		}

		if ( 'recaptcha-v3' === $kind ) {
			if ( self::ACTION !== ( $body['action'] ?? null ) ) {
				return $withScore(
					[
						'result' => 'fail',
						'note' => 'Wrong reCAPTCHA action',
					]
				);
			}

			$minScore = self::clampScore( $minScore );
			if ( null === $score || $score < $minScore ) {
				return $withScore(
					[
						'result' => 'fail',
						'note' => sprintf( 'Low reCAPTCHA score (%s)', null === $score ? '?' : (string) $score ),
					]
				);
			}
		}

		return $withScore( [ 'result' => 'pass' ] );
	}

	/** @return array{result: string, note: string} */
	private static function unchecked(): array {
		return [
			'result' => 'unchecked',
			'note' => 'Challenge not checked',
		];
	}
}
