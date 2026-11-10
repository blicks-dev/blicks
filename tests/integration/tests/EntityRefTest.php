<?php
/**
 * The Studio's entity route against a real WordPress: a block theme's template parts, a post type
 * that opted in, and the capability each asks for.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

/**
 * The unit suite covers what EntityRef decides; this covers what only WordPress can answer. Most
 * of all the template-part write, which goes through core's own template-parts route: a part still
 * in the theme's files must come back as a customised copy carrying the new blocks.
 *
 * The post kind uses a type registered here and nowhere else, so no Pro type is needed to prove it.
 */
final class EntityRefTest extends WP_UnitTestCase {

	private const THEME = 'twentytwentyfive';

	private const TYPE = 'blicks_test_entity';

	private WP_REST_Server $server;

	public function set_up(): void {
		parent::set_up();

		if ( ! wp_get_theme( self::THEME )->exists() ) {
			$this->markTestSkipped( 'Needs the ' . self::THEME . ' block theme.' );
		}

		switch_theme( self::THEME );

		register_post_type(
			self::TYPE,
			[
				'public' => false,
				'show_in_rest' => true,
				'capability_type' => 'post',
				'map_meta_cap' => true,
			]
		);

		add_filter( 'blicks_studio_entity_types', [ $this, 'optIn' ] );

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;

		do_action( 'rest_api_init', $this->server );
	}

	public function tear_down(): void {
		remove_filter( 'blicks_studio_entity_types', [ $this, 'optIn' ] );
		unregister_post_type( self::TYPE );

		parent::tear_down();
	}

	/**
	 * @param list<string> $types
	 * @return list<string>
	 */
	public function optIn( array $types ): array {
		return [ ...$types, self::TYPE ];
	}

	/** @param array<string, mixed> $params */
	private function call( string $method, array $params ): \WP_REST_Response {
		$request = new WP_REST_Request( $method, '/blicks/v1/studio/entity' );

		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		return $this->server->dispatch( $request );
	}

	private function as( string $role ): int {
		$user = self::factory()->user->create( [ 'role' => $role ] );
		wp_set_current_user( $user );

		return $user;
	}

	public function test_reads_a_theme_template_part_and_the_templates_that_place_it(): void {
		$this->as( 'administrator' );

		$response = $this->call( 'GET', [ 'kind' => 'template-part', 'id' => self::THEME . '//header' ] );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringContainsString( '<!-- wp:', $data['content'] );
		$this->assertNotSame( [], $data['usedOn'], 'The theme places its header in its templates.' );
	}

	public function test_saving_a_theme_template_part_makes_a_customised_copy(): void {
		$this->as( 'administrator' );
		$content = '<!-- wp:paragraph --><p>Saved from the Studio, "quoted" \\ slashed</p><!-- /wp:paragraph -->';

		$response = $this->call( 'POST', [ 'kind' => 'template-part', 'id' => self::THEME . '//header', 'content' => $content ] );

		$this->assertSame( 200, $response->get_status(), (string) wp_json_encode( $response->get_data() ) );

		$part = get_block_template( self::THEME . '//header', 'wp_template_part' );

		$this->assertSame( 'custom', $part->source );
		$this->assertSame( $content, $part->content );
		$this->assertSame( $content, $response->get_data()['content'] );
	}

	public function test_template_parts_need_edit_theme_options(): void {
		$this->as( 'editor' );

		$this->assertSame( 403, $this->call( 'GET', [ 'kind' => 'template-part', 'id' => self::THEME . '//header' ] )->get_status() );
		$this->assertSame( 403, $this->call( 'POST', [ 'kind' => 'template-part', 'id' => self::THEME . '//header', 'content' => 'x' ] )->get_status() );
	}

	public function test_a_post_of_an_opted_in_type_round_trips_with_its_slashes(): void {
		$this->as( 'administrator' );
		$id = self::factory()->post->create( [ 'post_type' => self::TYPE, 'post_title' => 'Size guide', 'post_content' => 'old' ] );
		$content = '<!-- wp:blicks/text {"content":"a \\u0022quote\\u0022"} /-->';

		$saved = $this->call( 'POST', [ 'kind' => 'post', 'type' => self::TYPE, 'id' => $id, 'content' => $content ] );
		$read = $this->call( 'GET', [ 'kind' => 'post', 'type' => self::TYPE, 'id' => $id ] );

		$this->assertSame( 200, $saved->get_status() );
		$this->assertSame( $content, get_post( $id )->post_content );
		$this->assertSame( [ 'content' => $content, 'title' => 'Size guide', 'usedOn' => [] ], $read->get_data() );
	}

	public function test_a_post_needs_edit_post_on_that_post(): void {
		$owner = $this->as( 'author' );
		$id = self::factory()->post->create( [ 'post_type' => self::TYPE, 'post_author' => $owner ] );
		$theirs = self::factory()->post->create( [ 'post_type' => self::TYPE, 'post_author' => self::factory()->user->create( [ 'role' => 'author' ] ) ] );

		$this->assertSame( 200, $this->call( 'GET', [ 'kind' => 'post', 'type' => self::TYPE, 'id' => $id ] )->get_status() );
		$this->assertSame( 403, $this->call( 'GET', [ 'kind' => 'post', 'type' => self::TYPE, 'id' => $theirs ] )->get_status() );
	}

	public function test_a_type_must_opt_in_and_must_match_the_post(): void {
		$this->as( 'administrator' );
		$page = self::factory()->post->create( [ 'post_type' => 'page' ] );

		// Not opted in.
		$this->assertSame( 403, $this->call( 'GET', [ 'kind' => 'post', 'type' => 'page', 'id' => $page ] )->get_status() );
		// An opted-in type naming a post of another type.
		$this->assertSame( 403, $this->call( 'GET', [ 'kind' => 'post', 'type' => self::TYPE, 'id' => $page ] )->get_status() );
	}

	public function test_anonymous_requests_are_rejected(): void {
		wp_set_current_user( 0 );

		$this->assertSame( 401, $this->call( 'GET', [ 'kind' => 'template-part', 'id' => self::THEME . '//header' ] )->get_status() );
	}
}
