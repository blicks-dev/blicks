<?php
/**
 * REST controller for kits.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\DesignKits;
use Blicks\DesignSystem\DesignLanguages;
use Blicks\DesignSystem\DesignThemes;
use Blicks\DesignSystem\Store;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Kits — list, save what is in use now, rename, delete, use. Using one answers with a fresh
 * design-system snapshot (and the palettes), the way using a palette does.
 */
final class KitsController {

	/** GET blicks/v1/design-system/kits */
	public static function index(): WP_REST_Response {
		return new WP_REST_Response( self::listing(), 200 );
	}

	/** POST blicks/v1/design-system/kits — save the language, palette and values in use now. */
	public static function create( WP_REST_Request $request ): WP_REST_Response {
		DesignKits::create(
			(string) $request->get_param( 'name' ),
			DesignLanguages::activeId(),
			DesignThemes::all()['active'],
			Store::values()
		);

		return new WP_REST_Response( self::listing(), 201 );
	}

	/** PATCH blicks/v1/design-system/kits/{id} — rename. */
	public static function update( WP_REST_Request $request ): WP_REST_Response {
		if ( ! DesignKits::rename( (string) $request->get_param( 'id' ), (string) $request->get_param( 'name' ) ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Kit not found.', 'blicks' ) ], 404 );
		}

		return new WP_REST_Response( self::listing(), 200 );
	}

	/** DELETE blicks/v1/design-system/kits/{id} */
	public static function remove( WP_REST_Request $request ): WP_REST_Response {
		if ( ! DesignKits::delete( (string) $request->get_param( 'id' ) ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Kit not found.', 'blicks' ) ], 404 );
		}

		return new WP_REST_Response( self::listing(), 200 );
	}

	/** POST blicks/v1/design-system/kits/{id}/apply — use a kit. */
	public static function apply( WP_REST_Request $request ): WP_REST_Response {
		if ( ! DesignKits::apply( (string) $request->get_param( 'id' ) ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Kit not found.', 'blicks' ) ], 404 );
		}

		$snapshot = Catalogue::snapshot();
		$snapshot['themes'] = DesignThemes::all();

		return new WP_REST_Response( $snapshot, 200 );
	}

	/**
	 * Every kit without its values (the admin lists them; using one is a round trip), each with how
	 * many values of its own it holds.
	 *
	 * @return list<array{id: string, name: string, language: string, palette: string, count: int}>
	 */
	private static function listing(): array {
		return array_map(
			static fn ( array $kit ): array => [
				'id' => $kit['id'],
				'name' => $kit['name'],
				'language' => $kit['language'],
				'palette' => $kit['palette'],
				'count' => array_sum( array_map( 'count', $kit['values']['tokens'] ) ) + count( $kit['values']['breakpoints'] ) + array_sum( array_map( 'count', $kit['values']['typeRoles'] ) ),
			],
			DesignKits::all()
		);
	}
}
