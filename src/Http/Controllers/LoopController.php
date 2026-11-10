<?php
/**
 * REST controller for Loop previews and the site's data endpoints.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Data\EndpointRegistry;
use Blicks\Data\EndpointSource;
use Blicks\Data\EndpointUsage;
use Blicks\Data\Loop;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Two jobs.
 *
 * **`loop/items`** gives the editor a Loop's items exactly as the page will get them. The editor
 * never fetches an endpoint or runs a query itself: it posts the block's attributes here and
 * renders what comes back. Anyone who can edit the post may ask, and only for that post.
 *
 * **`data-endpoints`** is the administrators' list of endpoints. Editors may read the names (to
 * pick one in a Loop) but not the addresses, and only administrators can add, change, remove or
 * test one — the point of the list is that an author cannot make the server fetch an address of
 * their choosing.
 */
final class LoopController {

	/** Items sent to the editor per preview. The page renders up to the Loop's own limit. */
	private const PREVIEW_ITEMS = 12;

	public static function items( WP_REST_Request $request ): WP_REST_Response {
		$attrs = $request->get_param( 'attributes' );
		$result = Loop::items( is_array( $attrs ) ? $attrs : [], (int) $request->get_param( 'postId' ), (bool) $request->get_param( 'refresh' ), max( 1, (int) $request->get_param( 'page' ) ) );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				[
					'code' => $result->get_error_code(),
					'message' => $result->get_error_message(),
				],
				422
			);
		}

		$result['items'] = array_slice( $result['items'], 0, self::PREVIEW_ITEMS );

		return new WP_REST_Response( $result, 200 );
	}

	/** Who may preview: anyone who can edit posts, and the given post when there is one. */
	public static function canPreview( WP_REST_Request $request ): bool {
		$post = (int) $request->get_param( 'postId' );

		return current_user_can( 'edit_posts' ) && ( $post <= 0 || current_user_can( 'edit_post', $post ) );
	}

	/**
	 * Administrators see every field and how the last fetch went (from the cache: listing never
	 * fetches); everyone else only what they need to choose an endpoint.
	 */
	public static function endpoints(): WP_REST_Response {
		$admin = current_user_can( 'manage_options' );
		$list = array_map(
			static fn ( array $e ): array => $admin ? $e + [ 'status' => EndpointSource::status( $e ) ] : [
				'id' => $e['id'],
				'name' => $e['name'],
				'cache' => $e['cache'],
			],
			EndpointRegistry::all()
		);

		return new WP_REST_Response( [ 'endpoints' => $list ], 200 );
	}

	public static function create( WP_REST_Request $request ): WP_REST_Response {
		return self::saved( EndpointRegistry::save( self::body( $request ) ), 201 );
	}

	public static function update( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		$before = EndpointRegistry::find( $id );
		$result = EndpointRegistry::save( self::body( $request ), $id );

		if ( $result['ok'] && null !== $before ) {
			EndpointSource::forget( $before );
		}

		return self::saved( $result, 200 );
	}

	public static function remove( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		$before = EndpointRegistry::find( $id );
		if ( null !== $before ) {
			EndpointSource::forget( $before );
		}

		return new WP_REST_Response( [ 'endpoints' => EndpointRegistry::delete( $id ) ], 200 );
	}

	/** How many posts have a Loop on the endpoint, for the warning before removing it. */
	public static function usage( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( [ 'count' => EndpointUsage::count( (string) $request->get_param( 'endpoint' ) ) ], 200 );
	}

	/** "Test now": fetch, store, and say how it went. */
	public static function test( WP_REST_Request $request ): WP_REST_Response {
		$started = microtime( true );
		$result = EndpointSource::refresh( (string) $request->get_param( 'id' ) );
		$ms = (int) round( ( microtime( true ) - $started ) * 1000 );

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				[
					'ok' => false,
					'message' => $result->get_error_message(),
					'ms' => $ms,
				],
				200
			);
		}

		return new WP_REST_Response(
			[
				'ok' => true,
				'ms' => $ms,
				'bytes' => strlen( (string) wp_json_encode( $result['value'] ) ),
				'fetchedAt' => $result['fetchedAt'],
			],
			200
		);
	}

	/**
	 * The fields as sent. The address is checked raw, so `http://` gets "Plain http is refused"
	 * rather than coming back empty from `esc_url_raw()`; the registry sanitises what it stores.
	 *
	 * @return array<string, mixed>
	 */
	private static function body( WP_REST_Request $request ): array {
		return [
			'name' => $request->get_param( 'name' ),
			'url' => (string) $request->get_param( 'url' ),
			'cache' => $request->get_param( 'cache' ),
			'keepLastGood' => $request->get_param( 'keepLastGood' ) ?? true,
		];
	}

	/** @param array{ok: bool, errors: array<string, string>, endpoints: list<array<string, mixed>>, id?: string} $result */
	private static function saved( array $result, int $status ): WP_REST_Response {
		if ( ! $result['ok'] ) {
			return new WP_REST_Response(
				[
					'code' => 'blicks_endpoint_invalid',
					'message' => implode( ' ', $result['errors'] ),
					'errors' => $result['errors'],
				],
				422
			);
		}

		return new WP_REST_Response(
			[
				'id' => $result['id'] ?? '',
				'endpoints' => $result['endpoints'],
			],
			$status
		);
	}
}
