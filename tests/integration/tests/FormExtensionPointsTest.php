<?php
/**
 * The Form's extension points, exercised by a pretend companion (fixtures/form-companion.php).
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Entries;
use Blicks\Forms\EntriesCsv;
use Blicks\Forms\FieldRenderer;
use Blicks\Forms\FieldTypes;
use Blicks\Forms\Schema;
use Blicks\Forms\Token;
use Blicks\Tests\Fixtures\FormCompanion;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use WP_UnitTestCase;

require_once dirname( __DIR__ ) . '/fixtures/form-companion.php';

final class FormExtensionPointsTest extends WP_UnitTestCase {

	private const FORM = 'e7e7e701';

	private WP_REST_Server $server;

	/** @var list<array<string, mixed>> */
	private array $mails = [];

	public function set_up(): void {
		parent::set_up();

		$this->mails = [];
		add_filter( 'pre_wp_mail', [ $this, 'catchMail' ], 10, 2 );
	}

	public function tear_down(): void {
		FormCompanion::shutdown();
		unset( $_SERVER['REMOTE_ADDR'] );

		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	/** @param array<string, mixed> $atts */
	public function catchMail( mixed $short, array $atts ): bool {
		$this->mails[] = $atts;

		return true;
	}

	/** The companion's hooks first, then the REST routes, as on a real site. */
	private function boot( bool $companion ): void {
		if ( $companion ) {
			FormCompanion::boot();
		}

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;
		do_action( 'rest_api_init', $this->server );
	}

	/** @param array<string, mixed> $a */
	private static function field( array $a ): string {
		return '<!-- wp:blicks/field ' . wp_json_encode( $a ) . ' /-->';
	}

	/** A published page holding the test form with these fields (block markup). */
	private function page( string $fields ): int {
		$attrs = [
			'uniqueId' => self::FORM,
			'email' => [
				'on' => true,
				'to' => 'owner@example.com',
			],
			'extensions' => [ 'fixture' => [ 'mode' => 'steps' ] ],
		];

		return self::factory()->post->create(
			[
				'post_type' => 'page',
				'post_title' => 'Feedback',
				'post_content' => '<!-- wp:blicks/form ' . wp_json_encode( $attrs ) . ' -->'
					. self::field(
						[
							'uniqueId' => 'bb01',
							'type' => 'text',
							'name' => 'name',
							'label' => 'Name',
							'required' => true,
						]
					)
					. $fields
					. '<!-- /wp:blicks/form -->',
			]
		);
	}

	/** @param array<string, mixed> $fields */
	private function send( int $post, array $fields ): WP_REST_Response {
		// A fresh address per send keeps the rate limit out of the way.
		$_SERVER['REMOTE_ADDR'] = '203.0.113.' . wp_rand( 1, 250 );

		$request = new WP_REST_Request( 'POST', '/blicks/v1/forms/' . self::FORM . '/entries' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body(
			(string) wp_json_encode(
				[
					'fields' => $fields,
					'token' => Token::issue( self::FORM, $post, time() - 10 )['token'],
					'post' => $post,
					'hp' => '',
				]
			)
		);

		return $this->server->dispatch( $request );
	}

	/** @return array<string, mixed> The newest entry. */
	private function latest(): array {
		$ids = get_posts(
			[
				'post_type' => Entries::POST_TYPE,
				'post_status' => 'any',
				'fields' => 'ids',
				'posts_per_page' => 1,
				'orderby' => 'ID',
				'order' => 'DESC',
			]
		);
		$this->assertNotEmpty( $ids );

		return (array) Entries::get( (int) $ids[0] );
	}

	private function admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}

	/** @param array<string, mixed> $params */
	private function call( string $method, string $path, array $params = [] ): WP_REST_Response {
		$request = new WP_REST_Request( $method, $path );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		return rest_do_request( $request );
	}

	private static function rating( bool $required = true ): string {
		return self::field(
			[
				'uniqueId' => 'bb02',
				'type' => 'rating',
				'name' => 'stars',
				'label' => 'Stars',
				'required' => $required,
			]
		);
	}

	public function test_an_unknown_type_is_kept_and_renders_nothing(): void {
		$this->boot( false );

		$attrs = [
			'type' => 'Rating',
			'name' => 'stars',
			'label' => 'Stars',
		];

		$this->assertSame( 'rating', Schema::field( $attrs )['type'] );
		$this->assertFalse( FieldTypes::registered( 'rating' ) );
		$this->assertSame( '', FieldRenderer::render( $attrs + [ 'uniqueId' => 'ab12' ] ) );
		$this->assertNull( FieldTypes::validate( Schema::field( $attrs ), '4' ) );

		$html = do_blocks( self::rating() );
		$this->assertStringNotContainsString( 'stars', $html );
		$this->assertStringNotContainsString( '<input', $html );
	}

	public function test_a_form_with_an_unknown_required_type_still_sends_without_it(): void {
		$this->boot( false );
		$post = $this->page( self::rating() );

		$response = $this->send(
			$post,
			[
				'name' => 'Ada',
				'stars' => '4',
			]
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'sent', $response->get_data()['status'] );

		$entry = $this->latest();
		$this->assertSame( [ 'name' => 'Ada' ], $entry['fields'] );
		$this->assertArrayNotHasKey( 'stars', $entry['labels'] );
		$this->assertArrayNotHasKey( 'stars', $entry['definitions'] );
		$this->assertSame( 'new', $entry['status'] );

		$this->assertCount( 1, $this->mails );
		$this->assertStringNotContainsString( 'Stars', $this->mails[0]['message'] );
	}

	public function test_extensions_pass_through_untouched(): void {
		$this->boot( false );

		$this->assertSame( [ 'pro' => [ 'logic' => [ 'match' => 'all' ] ] ], Schema::field( [ 'extensions' => [ 'pro' => [ 'logic' => [ 'match' => 'all' ] ] ] ] )['extensions'] );
		$this->assertSame( [], Schema::field( [ 'extensions' => 'nope' ] )['extensions'] );
		$this->assertSame( [ 'pro' => [ 'steps' => true ] ], Schema::settings( [ 'extensions' => [ 'pro' => [ 'steps' => true ] ] ] )['extensions'] );
		$this->assertSame( [], Schema::settings( [] )['extensions'] );
	}

	public function test_a_companion_type_renders_through_the_registry(): void {
		$this->boot( true );

		$this->assertTrue( FieldTypes::registered( 'rating' ) );

		$html = do_blocks( self::rating() );
		$this->assertStringContainsString( '<div class="fx-rating" data-bl-field="stars">', $html );
		$this->assertStringContainsString( '<span>Stars</span>', $html );
	}

	public function test_a_companion_type_validates_and_displays_everywhere(): void {
		$this->boot( true );
		$post = $this->page( self::rating() );

		$bad = $this->send(
			$post,
			[
				'name' => 'Ada',
				'stars' => '9',
			]
		);
		$this->assertSame( 422, $bad->get_status() );
		$this->assertSame( [ 'stars' => 'Pick 1 to 5 stars.' ], $bad->get_data()['errors'] );

		$missing = $this->send( $post, [ 'name' => 'Ada' ] );
		$this->assertSame( 422, $missing->get_status() );
		$this->assertSame( 'Pick a rating.', $missing->get_data()['errors']['stars'] );

		$good = $this->send(
			$post,
			[
				'name' => 'Ada',
				'stars' => '4',
			]
		);
		$this->assertSame( 200, $good->get_status() );

		$entry = $this->latest();
		$this->assertSame( 4, $entry['fields']['stars'] );
		$this->assertSame( 'rating', $entry['definitions']['stars']['type'] );

		// The email, the entries payload and the CSV all show the type's display.
		$this->assertCount( 1, $this->mails );
		$this->assertStringContainsString( '4 / 5', $this->mails[0]['message'] );

		$this->admin();
		$one = $this->call( 'GET', '/blicks/v1/forms/entries/' . $entry['id'] )->get_data();
		$this->assertSame( '4 / 5', $one['display']->stars );
		$this->assertSame( 'Ada', $one['display']->name );
		$list = $this->call( 'GET', '/blicks/v1/forms/entries' )->get_data();
		$this->assertSame( '4 / 5', $list['items'][0]['display']->stars );

		$rows = EntriesCsv::rows( [ $entry ] );
		$this->assertContains( 'Stars', $rows[0] );
		$this->assertContains( '4 / 5', $rows[1] );
	}

	public function test_blicks_entry_display_filters_every_value(): void {
		$this->boot( true );
		add_filter(
			'blicks_entry_display',
			static fn ( string $display, $value, array $field ): string => 'rating' === $field['type'] ? str_repeat( '*', (int) $value ) : $display,
			10,
			3
		);

		$this->assertSame( '***', FieldTypes::display( [ 'type' => 'rating' ], 3 ) );
		$this->assertSame( 'a, b', FieldTypes::display( [ 'type' => 'choice' ], [ 'a', 'b' ] ) );
	}

	public function test_a_built_in_type_takes_a_companion_display_and_keeps_its_render(): void {
		$this->boot( false );
		add_filter(
			'blicks_form_field_type_tel',
			static fn ( array $callbacks ): array => [ 'display' => static fn ( array $field, $value ): string => 'tel:' . $value ] + $callbacks
		);

		$this->assertSame( 'tel:12345', FieldTypes::display( [ 'type' => 'tel' ], '12345' ) );
		$this->assertStringContainsString( 'type="tel"', FieldRenderer::render( [ 'type' => 'tel', 'name' => 'phone', 'label' => 'Phone', 'uniqueId' => 'ab12' ] ) );
	}

	public function test_the_send_filters_run_in_order_and_shape_the_send(): void {
		$this->boot( true );
		$post = $this->page(
			self::rating( false ) . self::field(
				[
					'uniqueId' => 'bb03',
					'type' => 'text',
					'name' => 'dropme',
					'label' => 'Drop me',
				]
			)
		);

		$refused = $this->send( $post, [ 'name' => 'Mallory' ] );
		$this->assertSame( 422, $refused->get_status() );
		$this->assertSame( [ 'name' => 'Not you again.' ], $refused->get_data()['errors'] );
		$this->assertSame( [ 'values', 'errors' ], FormCompanion::$calls );

		FormCompanion::$calls = [];
		$response = $this->send(
			$post,
			[
				'name' => 'Ada',
				'dropme' => 'secret',
			]
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( [ 'values', 'errors', 'entry', 'sent', 'response' ], FormCompanion::$calls );

		$entry = $this->latest();
		$this->assertArrayNotHasKey( 'dropme', $entry['fields'] );
		$this->assertSame( 'pending', $entry['status'] );

		// The response filter adds, but cannot take `status` away.
		$data = $response->get_data();
		$this->assertSame( 'sent', $data['status'] );
		$this->assertSame( 'entry-' . $entry['id'], $data['next'] );
	}

	public function test_the_statuses_list_carries_a_companion_status(): void {
		$this->boot( true );
		$this->admin();

		$this->assertSame( [ 'new', 'handled', 'spam', 'pending' ], array_keys( Entries::statuses() ) );

		$id = Entries::create(
			[
				'form' => 'abc',
				'fields' => [ 'email' => 'a@example.com' ],
				'status' => 'pending',
			]
		);
		$this->assertSame( 'pending', Entries::get( $id )['status'] );

		$list = $this->call( 'GET', '/blicks/v1/forms/entries' )->get_data();
		$this->assertContains(
			[
				'slug' => 'pending',
				'label' => 'Pending',
				'count' => 1,
			],
			$list['statuses']
		);
		$this->assertSame( 'New', $list['statuses'][0]['label'] );
		$this->assertSame( 1, $list['counts']['pending'] );

		$this->assertSame( 200, $this->call( 'GET', '/blicks/v1/forms/entries', [ 'status' => 'pending' ] )->get_status() );
		$this->assertSame( 200, $this->call( 'PATCH', "/blicks/v1/forms/entries/{$id}", [ 'status' => 'handled' ] )->get_status() );
		$this->assertSame( 200, $this->call( 'POST', '/blicks/v1/forms/entries/bulk', [ 'ids' => [ $id ], 'do' => 'pending' ] )->get_status() );
		$this->assertSame( 'pending', Entries::get( $id )['status'] );
		$this->assertSame( 400, $this->call( 'PATCH', "/blicks/v1/forms/entries/{$id}", [ 'status' => 'paid' ] )->get_status() );
		$this->assertFalse( Entries::setStatus( $id, 'paid' ) );
	}

	public function test_a_built_in_status_cannot_be_removed(): void {
		add_filter( 'blicks_entry_statuses', static fn (): array => [ 'paid' => 'Paid' ] );

		$this->assertSame( [ 'new', 'handled', 'spam', 'paid' ], array_keys( Entries::statuses() ) );
	}

	public function test_a_companion_block_may_hold_fields_in_a_form(): void {
		$this->boot( true );

		// The Form sets no allowedBlocks, so any block may sit in it; with a list, the filter adds to it.
		$this->assertNull( \WP_Block_Type_Registry::get_instance()->get_registered( 'blicks/form' )->allowed_blocks );
		$metadata = apply_filters(
			'block_type_metadata',
			[
				'name' => 'blicks/form',
				'allowedBlocks' => [ 'blicks/field', 'blicks/field', 'not a name' ],
			]
		);
		$this->assertSame( [ 'blicks/field', 'fixture/step' ], $metadata['allowedBlocks'] );
		$this->assertSame( [ 'name' => 'blicks/box' ], apply_filters( 'block_type_metadata', [ 'name' => 'blicks/box' ] ) );

		$post = $this->page( '<!-- wp:fixture/step -->' . self::rating() . '<!-- /wp:fixture/step -->' );

		$html = do_blocks( (string) get_post_field( 'post_content', $post ) );
		$this->assertStringContainsString( '<div class="fx-step"><div class="fx-rating"', $html );

		$response = $this->send(
			$post,
			[
				'name' => 'Ada',
				'stars' => '5',
			]
		);
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 5, $this->latest()['fields']['stars'] );
	}
}
