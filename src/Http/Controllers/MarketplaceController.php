<?php
/**
 * REST: the Studio library's Marketplace shelf.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Marketplace\Client;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Same-origin routes the Studio calls; {@see Client} does the talking.
 */
final class MarketplaceController {

	public static function items( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = Client::list( 'items', Client::listQuery( $request->get_params() ) );

		if ( is_wp_error( $body ) ) {
			return $body;
		}

		return new WP_REST_Response(
			[
				'items' => is_array( $body['items'] ?? null ) ? $body['items'] : [],
				'total' => (int) ( $body['total'] ?? 0 ),
				'stale' => $body['stale'] ?? null,
				// Whether Pro items open here — so the shelf can show them locked or not without
				// ever seeing the key that decides it.
				'licensed' => Client::licensed(),
			],
			200
		);
	}

	public static function terms(): WP_REST_Response|WP_Error {
		$body = Client::list( 'terms', [] );

		return is_wp_error( $body ) ? $body : new WP_REST_Response( $body, 200 );
	}

	public static function content( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = Client::content( (string) $request->get_param( 'slug' ) );

		if ( is_wp_error( $body ) ) {
			return $body;
		}

		return new WP_REST_Response(
			[
				'slug' => (string) ( $body['slug'] ?? '' ),
				'version' => (string) ( $body['version'] ?? '' ),
				'tier' => (string) ( $body['tier'] ?? '' ),
				'content' => (string) ( $body['content'] ?? '' ),
				'keyframes' => is_array( $body['keyframes'] ?? null ) ? $body['keyframes'] : [],
			],
			200
		);
	}
}
