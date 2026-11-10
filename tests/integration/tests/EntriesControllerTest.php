<?php
/**
 * Blicks › Entries REST routes.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Entries;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

final class EntriesControllerTest extends WP_UnitTestCase {

	private WP_REST_Server $server;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;

		do_action( 'rest_api_init', $this->server );
	}

	public function tear_down(): void {
		global $wp_rest_server;
		$wp_rest_server = null;

		parent::tear_down();
	}

	private function admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}

	private function entry( string $form, array $fields, string $status = 'new', string $title = 'Contact' ): int {
		return Entries::create(
			[
				'form' => $form,
				'formTitle' => $title,
				'page' => '/contact',
				'fields' => $fields,
				'labels' => [ 'name' => 'Name', 'email' => 'Email', 'message' => 'Message' ],
				'status' => $status,
				'ipHash' => 'secret-hash-value',
				'userAgent' => 'TestAgent/1.0',
				'challenge' => 'none',
			]
		);
	}

	private function call( string $method, string $path, array $params = [] ): \WP_REST_Response {
		$request = new WP_REST_Request( $method, $path );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}

		return rest_do_request( $request );
	}

	public function test_subscriber_is_refused_everywhere(): void {
		$id = $this->entry( 'abc', [ 'email' => 'a@example.com' ] );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );

		$this->assertSame( 403, $this->call( 'GET', '/blicks/v1/forms/entries' )->get_status() );
		$this->assertSame( 403, $this->call( 'GET', "/blicks/v1/forms/entries/{$id}" )->get_status() );
		$this->assertSame( 403, $this->call( 'PATCH', "/blicks/v1/forms/entries/{$id}", [ 'status' => 'handled' ] )->get_status() );
		$this->assertSame( 403, $this->call( 'DELETE', "/blicks/v1/forms/entries/{$id}" )->get_status() );
		$this->assertSame( 403, $this->call( 'POST', '/blicks/v1/forms/entries/bulk', [ 'ids' => [ $id ], 'do' => 'delete' ] )->get_status() );
		$this->assertNotNull( Entries::get( $id ) );
	}

	public function test_list_shapes_entries_and_never_sends_the_ip_hash(): void {
		$this->admin();
		$this->entry( 'abc', [ 'name' => 'Sita Rai', 'email' => 'sita@example.com', 'message' => str_repeat( 'Do you deliver to Pokhara? ', 6 ) ] );

		$response = $this->call( 'GET', '/blicks/v1/forms/entries' );
		$this->assertSame( 200, $response->get_status() );

		$data = $response->get_data();
		$this->assertSame( 1, $data['total'] );
		$item = $data['items'][0];
		$this->assertSame( 'Sita Rai', $item['from'] );
		$this->assertSame( 'sita@example.com', $item['email'] );
		$this->assertStringStartsWith( 'Do you deliver to Pokhara?', $item['says'] );
		$this->assertLessThanOrEqual( 80, mb_strlen( $item['says'] ) );
		$this->assertArrayNotHasKey( 'userAgent', $item );
		$this->assertSame( [ [ 'id' => 'abc', 'title' => 'Contact', 'count' => 1 ] ], $data['forms'] );
		$this->assertSame( [ 'new' => 1, 'handled' => 0, 'spam' => 0 ], $data['counts'] );
		$this->assertStringContainsString( 'action=blicks_entries_csv', $data['csvUrl'] );
		$this->assertStringContainsString( '_wpnonce=', $data['csvUrl'] );

		$json = (string) wp_json_encode( $data );
		$this->assertStringNotContainsString( 'secret-hash-value', $json );
		$this->assertStringNotContainsString( 'ipHash', $json );
	}

	public function test_single_read_carries_the_user_agent_but_not_the_hash(): void {
		$this->admin();
		$id = $this->entry( 'abc', [ 'email' => 'a@example.com' ] );

		$response = $this->call( 'GET', "/blicks/v1/forms/entries/{$id}" );
		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'TestAgent/1.0', $response->get_data()['userAgent'] );
		$this->assertStringNotContainsString( 'secret-hash-value', (string) wp_json_encode( $response->get_data() ) );

		$this->assertSame( 404, $this->call( 'GET', '/blicks/v1/forms/entries/999999' )->get_status() );
	}

	public function test_filters_by_form_status_and_search(): void {
		$this->admin();
		$this->entry( 'abc', [ 'email' => 'one@example.com', 'message' => 'Pokhara please' ] );
		$this->entry( 'abc', [ 'email' => 'two@example.com', 'message' => 'Kathmandu' ], 'handled' );
		$this->entry( 'xyz', [ 'email' => 'three@example.com', 'message' => 'Café au lait' ], 'spam', 'Newsletter' );

		$this->assertSame( 2, $this->call( 'GET', '/blicks/v1/forms/entries', [ 'form' => 'abc' ] )->get_data()['total'] );
		$this->assertSame( 1, $this->call( 'GET', '/blicks/v1/forms/entries', [ 'status' => 'spam' ] )->get_data()['total'] );

		$found = $this->call( 'GET', '/blicks/v1/forms/entries', [ 'search' => 'Pokhara' ] )->get_data();
		$this->assertSame( 1, $found['total'] );
		$this->assertSame( 'one@example.com', $found['items'][0]['email'] );

		$this->assertSame( 1, $this->call( 'GET', '/blicks/v1/forms/entries', [ 'search' => 'Café' ] )->get_data()['total'] );
		$this->assertSame( 1, $this->call( 'GET', '/blicks/v1/forms/entries', [ 'search' => 'two@example' ] )->get_data()['total'] );
		$this->assertSame( 0, $this->call( 'GET', '/blicks/v1/forms/entries', [ 'search' => 'Kathmandu', 'form' => 'xyz' ] )->get_data()['total'] );

		$counts = $this->call( 'GET', '/blicks/v1/forms/entries', [ 'form' => 'abc' ] )->get_data()['counts'];
		$this->assertSame( [ 'new' => 1, 'handled' => 1, 'spam' => 0 ], $counts );

		$paged = $this->call( 'GET', '/blicks/v1/forms/entries', [ 'per_page' => 2, 'page' => 2 ] )->get_data();
		$this->assertCount( 1, $paged['items'] );
		$this->assertSame( 2, $paged['pages'] );
	}

	public function test_patch_delete_and_bulk(): void {
		$this->admin();
		$a = $this->entry( 'abc', [ 'email' => 'a@example.com' ] );
		$b = $this->entry( 'abc', [ 'email' => 'b@example.com' ] );
		$c = $this->entry( 'abc', [ 'email' => 'c@example.com' ] );

		$patched = $this->call( 'PATCH', "/blicks/v1/forms/entries/{$a}", [ 'status' => 'handled' ] );
		$this->assertSame( 200, $patched->get_status() );
		$this->assertSame( 'handled', $patched->get_data()['status'] );
		$this->assertSame( 400, $this->call( 'PATCH', "/blicks/v1/forms/entries/{$a}", [ 'status' => 'gone' ] )->get_status() );

		$this->assertSame( [ 'deleted' => true ], $this->call( 'DELETE', "/blicks/v1/forms/entries/{$a}" )->get_data() );
		$this->assertNull( get_post( $a ) );
		$this->assertSame( 404, $this->call( 'DELETE', "/blicks/v1/forms/entries/{$a}" )->get_status() );

		$other = self::factory()->post->create();
		$spam = $this->call( 'POST', '/blicks/v1/forms/entries/bulk', [ 'ids' => [ $b, $c, $other ], 'do' => 'spam' ] );
		$this->assertSame( [ 'done' => 2 ], $spam->get_data() );
		$this->assertSame( 'spam', Entries::get( $b )['status'] );

		$gone = $this->call( 'POST', '/blicks/v1/forms/entries/bulk', [ 'ids' => [ $b, $c, $other ], 'do' => 'delete' ] );
		$this->assertSame( [ 'done' => 2 ], $gone->get_data() );
		$this->assertNull( Entries::get( $c ) );
		$this->assertNotNull( get_post( $other ), 'A post that is not an entry is never deleted.' );
	}
}
