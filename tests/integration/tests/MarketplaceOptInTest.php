<?php
/**
 * The Marketplace shelf is opt-in: nothing leaves the site until an administrator turns it on.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Settings\AdminSettings;
use WP_REST_Server;
use WP_UnitTestCase;

final class MarketplaceOptInTest extends WP_UnitTestCase {

	private WP_REST_Server $server;

	/** @var list<string> URLs WordPress was asked to fetch during a test. */
	private array $requested = [];

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;
		do_action( 'rest_api_init', $this->server );

		delete_option( AdminSettings::MARKETPLACE_OPTION );
		$this->requested = [];

		// Record and short-circuit every outbound request, so the test never reaches the network.
		add_filter( 'pre_http_request', [ $this, 'record' ], 10, 3 );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}

	public function tear_down(): void {
		remove_filter( 'pre_http_request', [ $this, 'record' ], 10 );
		delete_option( AdminSettings::MARKETPLACE_OPTION );
		parent::tear_down();
	}

	/** @param false|array<string, mixed> $pre */
	public function record( $pre, array $args, string $url ): array {
		$this->requested[] = $url;

		return [
			'headers' => [],
			'body' => (string) wp_json_encode( [ 'items' => [], 'total' => 0 ] ),
			'response' => [ 'code' => 200, 'message' => 'OK' ],
			'cookies' => [],
			'filename' => null,
		];
	}

	public function test_is_off_by_default(): void {
		$this->assertFalse( AdminSettings::marketplaceEnabled() );
		$this->assertFalse( AdminSettings::snapshot()['marketplace'] );
	}

	public function test_every_route_refuses_and_sends_nothing_while_off(): void {
		foreach ( [ '/blicks/v1/marketplace/items', '/blicks/v1/marketplace/terms', '/blicks/v1/marketplace/items/aurora/content' ] as $path ) {
			$response = $this->server->dispatch( new \WP_REST_Request( 'GET', $path ) );

			$this->assertSame( 403, $response->get_status(), $path );
			$this->assertSame( 'blicks_marketplace_off', $response->get_data()['code'] ?? null, $path );
		}

		$this->assertSame( [], $this->requested );
	}

	public function test_a_cached_list_is_not_served_while_off(): void {
		update_option( AdminSettings::MARKETPLACE_OPTION, '1' );
		$this->server->dispatch( new \WP_REST_Request( 'GET', '/blicks/v1/marketplace/items' ) );
		update_option( AdminSettings::MARKETPLACE_OPTION, '0' );

		$response = $this->server->dispatch( new \WP_REST_Request( 'GET', '/blicks/v1/marketplace/items' ) );

		$this->assertSame( 403, $response->get_status() );
	}

	public function test_an_administrator_turns_it_on_through_settings(): void {
		$request = new \WP_REST_Request( 'PATCH', '/blicks/v1/settings' );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( (string) wp_json_encode( [ 'marketplace' => true ] ) );

		$response = $this->server->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['marketplace'] );
		$this->assertSame( '1', get_option( AdminSettings::MARKETPLACE_OPTION ) );

		$items = $this->server->dispatch( new \WP_REST_Request( 'GET', '/blicks/v1/marketplace/items' ) );

		$this->assertSame( 200, $items->get_status() );
		$this->assertCount( 1, $this->requested );
		$this->assertStringStartsWith( 'https://showcase.blicks.dev/', $this->requested[0] );
	}
}
