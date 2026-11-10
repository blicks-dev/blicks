<?php
/**
 * REST controller for the MCP admin screen.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Mcp\Access;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Turns MCP access on and off, and creates, renames and revokes agent passwords for the signed-in
 * account. Every agent route acts on the current user's own passwords only.
 */
final class McpAccessController {

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( Access::snapshot( get_current_user_id() ), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		Access::setEnabled( true === $request->get_param( 'enabled' ) );

		return self::show();
	}

	public static function createAgent( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$created = Access::createAgent( get_current_user_id(), (string) $request->get_param( 'client' ) );

		if ( is_wp_error( $created ) ) {
			return $created;
		}

		$response = new WP_REST_Response( $created, 201 );
		// The one response that carries a plain password: never cached anywhere on the way back.
		$response->header( 'Cache-Control', 'no-store' );

		return $response;
	}

	public static function renameAgent( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$result = Access::renameAgent( get_current_user_id(), (string) $request->get_param( 'uuid' ), (string) $request->get_param( 'name' ) );

		return is_wp_error( $result ) ? $result : self::show();
	}

	public static function revokeAgent( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$result = Access::revokeAgent( get_current_user_id(), (string) $request->get_param( 'uuid' ) );

		return is_wp_error( $result ) ? $result : self::show();
	}
}
