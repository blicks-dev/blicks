<?php
/**
 * Admin routes for Settings › Forms.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Http\Rest;
use Blicks\Forms\Challenge;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The spam-challenge keys, read and written by administrators.
 *
 * Secrets are write-only: GET answers `{ siteKey, hasSecret }` per provider and never the secret;
 * a PATCH with the secret omitted or empty keeps the stored one; `clear: true` removes both keys.
 */
final class FormsSettingsController {

	/** Request/response key → Challenge kind. */
	private const PROVIDERS = [
		'recaptchaV3' => 'recaptcha-v3',
		'recaptchaV2' => 'recaptcha-v2',
		'turnstile' => 'turnstile',
	];

	/** Declare the routes (called from RestServiceProvider on init). */
	public static function routes(): void {
		$provider = [
			'type' => 'object',
			'validate_callback' => static fn ( $value ): bool => is_array( $value ),
		];

		Rest::get( 'blicks/v1', 'forms/settings', [ self::class, 'show' ] )
			->permission( fn () => current_user_can( 'manage_options' ) );

		Rest::patch( 'blicks/v1', 'forms/settings', [ self::class, 'update' ] )
			->permission( fn () => current_user_can( 'manage_options' ) )
			->schema(
				[
					'recaptchaV3' => $provider,
					'recaptchaV2' => $provider,
					'turnstile' => $provider,
					'minScore' => [
						'type' => 'number',
						'minimum' => 0,
						'maximum' => 1,
					],
				]
			);
	}

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( self::snapshot(), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$stored = get_option( Challenge::OPTION, [] );
		$stored = is_array( $stored ) ? $stored : [];
		$keys = Challenge::keys();

		foreach ( self::PROVIDERS as $param => $kind ) {
			$input = $request->get_param( $param );
			if ( ! is_array( $input ) ) {
				continue;
			}

			$pair = $keys[ $kind ];

			if ( true === rest_sanitize_boolean( $input['clear'] ?? false ) ) {
				$pair = [
					'siteKey' => '',
					'secret' => '',
				];
			} else {
				if ( array_key_exists( 'siteKey', $input ) && is_string( $input['siteKey'] ) ) {
					$pair['siteKey'] = self::cleanSiteKey( $input['siteKey'] );
				}

				$secret = is_string( $input['secret'] ?? null ) ? trim( sanitize_text_field( $input['secret'] ) ) : '';
				if ( '' !== $secret ) {
					$pair['secret'] = $secret;
				}
			}

			$stored[ $kind ] = $pair;
		}

		$minScore = $request->get_param( 'minScore' );
		if ( is_numeric( $minScore ) ) {
			$stored['minScore'] = Challenge::clampScore( (float) $minScore );
		}

		// Never autoloaded: the secrets are read only when a form is sent.
		update_option( Challenge::OPTION, $stored, false );

		return new WP_REST_Response( self::snapshot(), 200 );
	}

	/**
	 * What the screen may see: site keys, whether a secret is set, the default score.
	 *
	 * @return array<string, mixed>
	 */
	public static function snapshot(): array {
		$keys = Challenge::keys();
		$out = [];

		foreach ( self::PROVIDERS as $param => $kind ) {
			$out[ $param ] = [
				'siteKey' => $keys[ $kind ]['siteKey'],
				'hasSecret' => '' !== $keys[ $kind ]['secret'],
			];
		}

		$out['minScore'] = Challenge::minScore();

		return $out;
	}

	/** Site keys are base64url-ish tokens from the provider: keep only those characters. */
	private static function cleanSiteKey( string $value ): string {
		return substr( (string) preg_replace( '/[^A-Za-z0-9_-]/', '', $value ), 0, 200 );
	}
}
