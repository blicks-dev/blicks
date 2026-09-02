<?php
/**
 * REST controller for the custom keyframe library.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Animations;
use Blicks\DesignSystem\Keyframes;
use WP_REST_Request;
use WP_REST_Response;

/**
 * CRUD for the custom keyframe library. Separate from the design-system PATCH endpoint: that one
 * saves a dirty *token bag*, these are records with add/rename/delete, so they follow the
 * `design-system/themes` shape and persist immediately.
 */
final class AnimationsController {

	public static function index(): WP_REST_Response {
		return new WP_REST_Response( self::payload( Animations::all() ), 200 );
	}

	public static function create( WP_REST_Request $request ): WP_REST_Response {
		$result = Animations::save( self::body( $request ) );

		if ( ! $result['ok'] ) {
			return self::failure( $result );
		}

		return new WP_REST_Response( self::payload( $result['animations'] ), 201 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$original = (string) $request->get_param( 'slug' );
		if ( null === Animations::find( $original ) ) {
			return new WP_REST_Response(
				[
					'code' => 'blicks_animation_not_found',
					'message' => __( 'That animation no longer exists.', 'blicks' ),
				],
				404
			);
		}

		$result = Animations::save( self::body( $request ), $original );

		if ( ! $result['ok'] ) {
			return self::failure( $result );
		}

		return new WP_REST_Response( self::payload( $result['animations'] ), 200 );
	}

	public static function remove( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( self::payload( Animations::delete( (string) $request->get_param( 'slug' ) ) ), 200 );
	}

	/**
	 * @param list<array<string,mixed>> $animations
	 * @return array<string,mixed>
	 */
	private static function payload( array $animations ): array {
		return [
			// The user's own records — what the admin section edits.
			'animations' => $animations,
			// Predefined ∪ custom: the one list the block Motion control renders.
			'library' => Animations::library(),
			// The rendered CSS rides along so the admin can hot-swap its <style> after a save
			// without waiting for a reload to pick up the new inline stylesheet.
			'css' => Keyframes::css( $animations ),
			'prefix' => Keyframes::PREFIX,
		];
	}

	/** @return array<string,mixed> */
	private static function body( WP_REST_Request $request ): array {
		$json = $request->get_json_params();

		return is_array( $json ) ? $json : $request->get_body_params();
	}

	/** @param array{error?:string,animations:list<array<string,mixed>>} $result */
	private static function failure( array $result ): WP_REST_Response {
		$error = $result['error'] ?? 'invalid';
		$messages = [
			'duplicate' => __( 'An animation with that name already exists.', 'blicks' ),
			'limit' => __( 'The animation library is full.', 'blicks' ),
			'invalid' => __( 'That animation needs a name and at least one step with a supported property.', 'blicks' ),
		];

		return new WP_REST_Response(
			[
				'code' => 'blicks_animation_' . $error,
				'message' => $messages[ $error ] ?? $messages['invalid'],
			],
			400
		);
	}
}
