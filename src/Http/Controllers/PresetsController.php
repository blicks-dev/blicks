<?php
/**
 * REST controller for user-saved block design presets.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Presets\Presets;
use WP_REST_Request;
use WP_REST_Response;

/**
 * CRUD for the user-saved preset library. Follows the `design-system/animations` shape: records with
 * create/rename/delete that persist immediately. Every response carries the full grouped library so
 * the editor can reconcile its registered variations after any change.
 */
final class PresetsController {

	public static function index(): WP_REST_Response {
		return new WP_REST_Response( [ 'presets' => Presets::grouped() ], 200 );
	}

	public static function create( WP_REST_Request $request ): WP_REST_Response {
		$result = Presets::save( self::body( $request ) );

		if ( ! $result['ok'] ) {
			return self::failure( $result );
		}

		return new WP_REST_Response(
			[
				'preset' => $result['preset'],
				'blockName' => $result['blockName'],
				'presets' => Presets::grouped(),
			],
			201
		);
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$id = (int) $request->get_param( 'id' );
		$result = Presets::save( self::body( $request ), $id );

		if ( ! $result['ok'] ) {
			return self::failure( $result );
		}

		return new WP_REST_Response(
			[
				'preset' => $result['preset'],
				'blockName' => $result['blockName'],
				'presets' => Presets::grouped(),
			],
			200
		);
	}

	public static function remove( WP_REST_Request $request ): WP_REST_Response {
		$result = Presets::delete( (int) $request->get_param( 'id' ) );

		if ( ! $result['ok'] ) {
			return self::failure( $result );
		}

		return new WP_REST_Response(
			[
				'blockName' => $result['blockName'],
				'key' => $result['key'],
				'presets' => Presets::grouped(),
			],
			200
		);
	}

	/** @return array<string,mixed> */
	private static function body( WP_REST_Request $request ): array {
		$json = $request->get_json_params();

		return is_array( $json ) ? $json : $request->get_body_params();
	}

	/** @param array{error?:string} $result */
	private static function failure( array $result ): WP_REST_Response {
		$error = $result['error'] ?? 'invalid';
		$map = [
			'invalid_block' => [ 400, __( 'That is not a valid block for a preset.', 'blicks' ) ],
			'invalid_title' => [ 400, __( 'A preset needs a name.', 'blicks' ) ],
			'invalid_attributes' => [ 400, __( 'That preset has no styles to save.', 'blicks' ) ],
			'limit' => [ 400, __( 'The preset library is full.', 'blicks' ) ],
			'not_found' => [ 404, __( 'That preset no longer exists.', 'blicks' ) ],
		];
		[ $status, $message ] = $map[ $error ] ?? [ 400, __( 'That preset could not be saved.', 'blicks' ) ];

		return new WP_REST_Response(
			[
				'code' => 'blicks_preset_' . $error,
				'message' => $message,
			],
			$status
		);
	}
}
