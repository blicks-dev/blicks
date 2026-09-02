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
 * Named local design themes — list / create / update / delete / apply. Applying reuses the same
 * {@see Store::saveOverrides()} path as a normal token save, so theme-json sync and the
 * forward-only option migration behave identically.
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

		return new WP_REST_Response( DesignThemes::create( $name, $tokens ), 201 );
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
	 * POST blicks/v1/design-system/themes/{id}/apply — write the theme's token bag through the
	 * shared save path and return a fresh design-system snapshot (same shape as PATCH /design-system).
	 */
	public static function apply( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		$theme = DesignThemes::find( $id );
		if ( null === $theme ) {
			return new WP_REST_Response( [ 'message' => __( 'Theme not found.', 'blicks' ) ], 404 );
		}

		// Switch first, then project the now-active theme's bag through the shared save path so its
		// values reach the option/Global Styles and the returned snapshot reflects it.
		DesignThemes::setActive( $id );
		$payload = is_array( $theme['tokens'] ) ? $theme['tokens'] : [];
		$overrides = Store::saveOverrides( $payload );

		$snapshot = Catalogue::withSavedValues( Catalogue::snapshot( $overrides ), $payload );
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
			return new WP_REST_Response( [ 'message' => __( 'Theme not found.', 'blicks' ) ], 404 );
		}

		DesignThemes::resetTheme( $id );
		$bag = DesignThemes::activeBag();
		$overrides = Store::saveOverrides( $bag );

		$snapshot = Catalogue::withSavedValues( Catalogue::snapshot( $overrides ), $bag );
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
