<?php
/**
 * Every REST route registers, and every one of them is gated.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use WP_REST_Server;
use WP_UnitTestCase;

final class RestRoutesTest extends WP_UnitTestCase {

	private WP_REST_Server $server;

	/**
	 * Every route the plugin promises: method, path, and any parameters WordPress requires.
	 *
	 * The parameters matter. WordPress validates required arguments before it consults the
	 * permission callback, so a request that omits them is answered 400 and never proves
	 * anything about authorisation.
	 */
	private const ROUTES = [
		[ 'GET', '/blicks/v1/dashboard', [] ],
		[ 'GET', '/blicks/v1/diagnostics', [] ],
		[ 'GET', '/blicks/v1/design-system', [] ],
		[ 'PATCH', '/blicks/v1/design-system', [] ],
		[ 'GET', '/blicks/v1/design-system/themes', [] ],
		[ 'POST', '/blicks/v1/design-system/themes', [ 'name' => 'probe' ] ],
		[ 'GET', '/blicks/v1/design-system/animations', [] ],
		[ 'POST', '/blicks/v1/design-system/animations', [ 'slug' => 'probe', 'steps' => [ [ 'offset' => 0 ] ] ] ],
		[ 'GET', '/blicks/v1/settings', [] ],
		[ 'PATCH', '/blicks/v1/settings', [] ],
	];

	/** Build a request with its required parameters filled in. */
	private function request( string $method, string $path, array $params ): \WP_REST_Request {
		$request = new \WP_REST_Request( $method, $path );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		return $request;
	}

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;

		do_action( 'rest_api_init', $this->server );
	}

	public function test_every_route_is_registered(): void {
		$registered = $this->server->get_routes();

		foreach ( self::ROUTES as [ $method, $path, $params ] ) {
			$this->assertArrayHasKey( $path, $registered, "Route {$path} is not registered." );

			$methods = [];
			foreach ( $registered[ $path ] as $handler ) {
				$methods = array_merge( $methods, array_keys( $handler['methods'] ) );
			}

			$this->assertContains( $method, $methods, "Route {$path} does not accept {$method}." );
		}
	}

	public function test_no_route_is_left_public(): void {
		foreach ( $this->server->get_routes() as $path => $handlers ) {
			// `/blicks/v1` itself is the namespace index, registered by WordPress rather than by
			// this plugin, and it is public by design.
			if ( ! str_starts_with( $path, '/blicks/v1/' ) ) {
				continue;
			}

			foreach ( $handlers as $handler ) {
				$this->assertArrayHasKey(
					'permission_callback',
					$handler,
					"Route {$path} has no permission callback."
				);
				$this->assertIsCallable(
					$handler['permission_callback'],
					"Route {$path} has a permission callback that cannot be called."
				);
			}
		}
	}

	/**
	 * The check that matters: a logged-out request must not reach a handler. A permission
	 * callback that exists but always returns true would pass the test above and still leak
	 * the whole design system.
	 */
	public function test_anonymous_requests_are_rejected(): void {
		wp_set_current_user( 0 );

		foreach ( self::ROUTES as [ $method, $path, $params ] ) {
			$response = $this->server->dispatch( $this->request( $method, $path, $params ) );

			$this->assertContains(
				$response->get_status(),
				[ 401, 403 ],
				"{$method} {$path} answered {$response->get_status()} to an anonymous request."
			);
		}
	}

	public function test_subscribers_are_rejected(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		foreach ( self::ROUTES as [ $method, $path, $params ] ) {
			$response = $this->server->dispatch( $this->request( $method, $path, $params ) );

			$this->assertContains(
				$response->get_status(),
				[ 401, 403 ],
				"{$method} {$path} answered {$response->get_status()} to a subscriber."
			);
		}
	}

	public function test_administrators_can_read_the_design_system(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$response = $this->server->dispatch( new \WP_REST_Request( 'GET', '/blicks/v1/design-system' ) );

		$this->assertSame( 200, $response->get_status() );
		$this->assertIsArray( $response->get_data() );
	}
}
