<?php
/**
 * REST controller for reading and updating the design system.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\Store;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Reads and updates the design system over REST.
 */
final class DesignSystemController {

	/**
	 * GET blicks/v1/design-system
	 */
	public static function show(): WP_REST_Response {
		return new WP_REST_Response( Catalogue::snapshot(), 200 );
	}

	/**
	 * PATCH blicks/v1/design-system
	 */
	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) ) {
			$payload = $request->get_body_params();
		}
		if ( ! is_array( $payload ) ) {
			return new WP_REST_Response( [ 'message' => __( 'A JSON object is required.', 'blicks' ) ], 400 );
		}

		// Register any user-added slugs first so their values survive sanitisation in saveOverrides.
		if ( isset( $payload['customSlugs'] ) && is_array( $payload['customSlugs'] ) ) {
			Store::registerCustomSlugs( $payload['customSlugs'] );
		}

		// Group reset: clear a category's local overrides + custom slugs before saving the rest.
		if ( isset( $payload['reset'] ) && is_array( $payload['reset'] ) ) {
			foreach ( $payload['reset'] as $category ) {
				if ( is_string( $category ) ) {
					Store::resetCategory( $category );
				}
			}
		}

		$overrides = Store::saveOverrides( $payload );
		$snapshot = Catalogue::withSavedValues( Catalogue::snapshot( $overrides ), $payload );

		return new WP_REST_Response( $snapshot, 200 );
	}
}
