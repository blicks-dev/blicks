<?php
/**
 * REST controller for the design language.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\DesignLanguages;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The design language: list the built-ins and choose one. Choosing changes no saved value — the
 * language is a layer under them — so the response is a fresh snapshot the page adopts as is.
 */
final class DesignLanguageController {

	/** GET blicks/v1/design-system/language */
	public static function index(): WP_REST_Response {
		return new WP_REST_Response( DesignLanguages::summary(), 200 );
	}

	/** POST blicks/v1/design-system/language — choose one by id. */
	public static function choose( WP_REST_Request $request ): WP_REST_Response {
		if ( ! DesignLanguages::setActive( (string) $request->get_param( 'id' ) ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Design language not found.', 'blicks' ) ], 404 );
		}

		return new WP_REST_Response( Catalogue::snapshot(), 200 );
	}
}
