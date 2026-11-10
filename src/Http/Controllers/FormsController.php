<?php
/**
 * Public form routes: token and send.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Http\Rest;
use Blicks\Forms\Locator;
use Blicks\Forms\Schema;
use Blicks\Forms\Submission;
use Blicks\Forms\Token;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The two routes a visitor's browser calls. Both are public by design: a form is for people who
 * are not signed in. **The token is their permission**, not the WordPress user — see
 * docs/blicks/plans/form-contracts.md ("Token", "Order of checks in submit") and
 * {@see Submission::handle()}, where every check runs in the order the contract fixes: the saved
 * form, the rate limit, the origin, the signed single-use token with its timing check, the trap,
 * validation by type, the challenge.
 */
final class FormsController {

	/** Declare the routes (called from RestServiceProvider on init). */
	public static function routes(): void {
		// Public: issues a short-lived token bound to this form and post. Nothing secret in it.
		Rest::get( 'blicks/v1', 'forms/(?P<form>[a-z0-9]+)/token', [ self::class, 'token' ] )
			->permission( '__return_true' )
			->schema(
				[
					'form' => self::formArg(),
					'post' => self::postArg(),
				]
			);

		// Public: the token (checked in Submission::handle) is the permission.
		Rest::post( 'blicks/v1', 'forms/(?P<form>[a-z0-9]+)/entries', [ self::class, 'submit' ] )
			->permission( '__return_true' )
			->schema(
				[
					'form' => self::formArg(),
					'post' => self::postArg(),
					'token' => self::stringArg(),
					'hp' => self::stringArg(),
					'challenge' => self::stringArg(),
				]
			);
	}

	public static function token( WP_REST_Request $request ): WP_REST_Response {
		$form = Schema::uid( (string) $request->get_param( 'form' ) );
		$post = absint( $request->get_param( 'post' ) );

		if ( '' === $form || null === Locator::find( $form, $post ) ) {
			$response = new WP_REST_Response( [ 'code' => 'blicks_form_missing' ], 404 );
		} else {
			$response = new WP_REST_Response( Token::issue( $form, $post ), 200 );
		}

		$response->header( 'Cache-Control', 'no-store, max-age=0' );

		return $response;
	}

	public static function submit( WP_REST_Request $request ): WP_REST_Response {
		$response = Submission::handle( $request );
		$response->header( 'Cache-Control', 'no-store, max-age=0' );

		return $response;
	}

	/** @return array<string, mixed> */
	private static function formArg(): array {
		return [
			'type' => 'string',
			'required' => true,
			'sanitize_callback' => static fn ( $value ): string => Schema::uid( $value ),
			'validate_callback' => static fn ( $value ): bool => '' !== Schema::uid( $value ),
		];
	}

	/** @return array<string, mixed> */
	private static function postArg(): array {
		return [
			'type' => 'integer',
			'default' => 0,
			'sanitize_callback' => 'absint',
			'validate_callback' => static fn ( $value ): bool => is_numeric( $value ),
		];
	}

	/**
	 * A string the handler reads as-is (a token, the trap, a provider's response): only its type
	 * is enforced here; each is compared, never stored or printed.
	 *
	 * @return array<string, mixed>
	 */
	private static function stringArg(): array {
		return [
			'type' => 'string',
			'validate_callback' => static fn ( $value ): bool => is_string( $value ) && strlen( $value ) <= 4096,
		];
	}
}
