<?php
/**
 * REST controller for named local design themes.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\DesignThemes;
use Blicks\DesignSystem\Store;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Palettes (the routes keep their older "themes" name) — list / create / update / delete / use.
 * A palette is colours only; using one repaints them and leaves someone's other values alone.
 */
final class ThemesController {

	/** GET blicks/v1/design-system/themes */
	public static function index(): WP_REST_Response {
		return new WP_REST_Response( DesignThemes::all(), 200 );
	}

	/** POST blicks/v1/design-system/themes — create from a token payload (snapshot of current values). */
	public static function create( WP_REST_Request $request ): WP_REST_Response {
		$name = (string) $request->get_param( 'name' );
		$tokens = self::tokenPayload( $request );

		// The new palette holds the colours in use, so it becomes the one in use and those colours
		// stop being someone's own: the next palette repaints them.
		$all = DesignThemes::create( $name, $tokens );
		Store::usePalette( $all['active'] );

		return new WP_REST_Response( DesignThemes::all(), 201 );
	}

	/** PATCH blicks/v1/design-system/themes/{id} — rename and/or re-snapshot a custom theme. */
	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		$name = $request->get_param( 'name' );
		$rawTokens = $request->get_param( 'tokens' );

		return new WP_REST_Response(
			DesignThemes::update(
				$id,
				is_string( $name ) ? $name : null,
				is_array( $rawTokens ) ? self::tokenPayload( $request ) : null
			),
			200
		);
	}

	/** DELETE blicks/v1/design-system/themes/{id} — custom themes only. */
	public static function remove( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );

		return new WP_REST_Response( DesignThemes::delete( $id ), 200 );
	}

	/**
	 * POST blicks/v1/design-system/themes/{id}/apply — use a palette and return a fresh
	 * design-system snapshot (same shape as PATCH /design-system).
	 */
	public static function apply( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		if ( null === DesignThemes::find( $id ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Palette not found.', 'blicks' ) ], 404 );
		}

		Store::usePalette( $id );

		$snapshot = Catalogue::snapshot();
		$snapshot['themes'] = DesignThemes::all();

		return new WP_REST_Response( $snapshot, 200 );
	}

	/**
	 * POST blicks/v1/design-system/themes/{id}/reset — clear a theme's overrides (built-in returns to
	 * its curated preset, custom to the shared base). If it's the active theme the change is projected
	 * live; the response is the same snapshot shape as apply so the page can adopt it.
	 */
	public static function reset( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		if ( null === DesignThemes::find( $id ) ) {
			return new WP_REST_Response( [ 'message' => __( 'Palette not found.', 'blicks' ) ], 404 );
		}

		DesignThemes::resetTheme( $id );

		$snapshot = Catalogue::snapshot();
		$snapshot['themes'] = DesignThemes::all();

		return new WP_REST_Response( $snapshot, 200 );
	}

	/**
	 * Pull the `{tokens, breakpoints, typeRoles}` slices off the request into one payload.
	 *
	 * @return array<string, mixed>
	 */
	private static function tokenPayload( WP_REST_Request $request ): array {
		$payload = [];
		foreach ( [ 'tokens', 'breakpoints', 'typeRoles' ] as $key ) {
			$value = $request->get_param( $key );
			if ( is_array( $value ) ) {
				$payload[ $key ] = $value;
			}
		}

		return $payload;
	}
}
