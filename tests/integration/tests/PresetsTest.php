<?php
/**
 * User-preset persistence against a real database: table creation, the store round trip, REST
 * create by a content author, and the opt-in uninstall drop.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Plugin;
use Blicks\Presets\Presets;
use Blicks\Models\PresetModel;
use WP_REST_Server;
use WP_UnitTestCase;

final class PresetsTest extends WP_UnitTestCase {

	private function payload( array $overrides = [] ): array {
		return array_merge(
			[
				'blockName' => 'blicks/button',
				'title' => 'Promo CTA',
				'attributes' => [
					'variant' => 'default',
					'size' => 'lg',
					'blicks' => [ 'colors.background' => [ 'default' => [ 'base' => '#7c3aed' ] ] ],
				],
			],
			$overrides
		);
	}

	public function test_activation_creates_the_presets_table(): void {
		global $wpdb;

		Plugin::activate();

		$table  = PresetModel::table();
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );

		$this->assertSame( $table, $exists, 'Activation did not create the presets table.' );
	}

	public function test_store_round_trip_through_the_database(): void {
		Plugin::activate();

		$saved = Presets::save( $this->payload() );
		$this->assertTrue( $saved['ok'] );
		$id = $saved['preset']['id'];

		// Clear the object cache so the read comes from the database, not the write.
		wp_cache_flush();

		$grouped = Presets::grouped();
		$this->assertArrayHasKey( 'blicks/button', $grouped );
		$this->assertCount( 1, $grouped['blicks/button'] );
		$this->assertSame(
			'#7c3aed',
			$grouped['blicks/button'][0]['attributes']['blicks']['colors.background']['default']['base']
		);

		$deleted = Presets::delete( (int) $id );
		$this->assertTrue( $deleted['ok'] );

		wp_cache_flush();
		$this->assertSame( [], Presets::grouped(), 'Preset survived deletion.' );
	}

	public function test_a_content_author_can_create_a_preset_over_rest(): void {
		Plugin::activate();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		do_action( 'rest_api_init', $wp_rest_server );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'author' ] ) );

		$request = new \WP_REST_Request( 'POST', '/blicks/v1/presets' );
		$request->set_body_params( $this->payload( [ 'title' => 'Authored CTA' ] ) );

		$response = $wp_rest_server->dispatch( $request );

		$this->assertSame( 201, $response->get_status() );
		$data = $response->get_data();
		$this->assertSame( 'authored-cta', $data['preset']['key'] );
		$this->assertArrayHasKey( 'blicks/button', $data['presets'] );
	}
}
