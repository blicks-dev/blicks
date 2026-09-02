<?php
/**
 * REST controller for the plugin settings screen.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Settings\AdminSettings;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Reads and updates the plugin settings over REST.
 */
final class SettingsController {

	public static function show(): WP_REST_Response {
		return new WP_REST_Response( AdminSettings::snapshot(), 200 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( AdminSettings::save( (array) $request->get_json_params() ), 200 );
	}
}
