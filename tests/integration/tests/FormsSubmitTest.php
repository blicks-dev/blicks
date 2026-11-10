<?php
/**
 * Sending a form: the order of checks, the entry, the email.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Entries;
use Blicks\Forms\Token;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use WP_UnitTestCase;

final class FormsSubmitTest extends WP_UnitTestCase {

	private const FORM = 'c0ffee01';

	private WP_REST_Server $server;

	private int $post;

	/** @var list<array<string, mixed>> */
	private array $mails = [];

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;
		do_action( 'rest_api_init', $this->server );

		$_SERVER['REMOTE_ADDR'] = '198.51.100.' . wp_rand( 1, 250 );
		$this->mails = [];
		add_filter( 'pre_wp_mail', [ $this, 'catchMail' ], 10, 2 );

		$this->post = $this->page( [] );
	}

	public function tear_down(): void {
		remove_filter( 'pre_wp_mail', [ $this, 'catchMail' ], 10 );
		unset( $_SERVER['REMOTE_ADDR'] );
		parent::tear_down();
	}

	/** @param array<string, mixed> $atts */
	public function catchMail( mixed $short, array $atts ): bool {
		$this->mails[] = $atts;

		return true;
	}

	/** A published page holding the test form, with these Form attributes. */
	private function page( array $formAttrs ): int {
		$attrs = $formAttrs + [
			'uniqueId' => self::FORM,
			'email' => [
				'on' => true,
				'to' => 'owner@example.com',
				'subject' => 'Hello from {name}',
				'replyTo' => true,
			],
			'after' => [
				'kind' => 'message',
				'message' => 'Thanks!',
			],
		];

		$field = static fn ( array $a ): string => '<!-- wp:blicks/field ' . wp_json_encode( $a ) . ' /-->';

		return self::factory()->post->create(
			[
				'post_type' => 'page',
				'post_title' => 'Contact',
				'post_content' => '<!-- wp:blicks/form ' . wp_json_encode( $attrs ) . ' -->'
					. $field(
						[
							'uniqueId' => 'aa01',
							'type' => 'text',
							'name' => 'name',
							'label' => 'Name',
							'required' => true,
							'errorMessage' => 'Tell us your name.',
						]
					)
					. $field(
						[
							'uniqueId' => 'aa02',
							'type' => 'email',
							'name' => 'email',
							'label' => 'Email',
							'required' => true,
						]
					)
					. $field(
						[
							'uniqueId' => 'aa03',
							'type' => 'textarea',
							'name' => 'message',
							'label' => 'Message',
						]
					)
					. '<!-- /wp:blicks/form -->',
			]
		);
	}

	private function token(): string {
		return Token::issue( self::FORM, $this->post, time() - 10 )['token'];
	}

	/**
	 * @param array<string, mixed>  $body
	 * @param array<string, string> $headers
	 */
	private function send( array $body, array $headers = [] ): WP_REST_Response {
		$request = new WP_REST_Request( 'POST', '/blicks/v1/forms/' . self::FORM . '/entries' );
		$request->set_header( 'content-type', 'application/json' );

		foreach ( $headers as $name => $value ) {
			$request->set_header( $name, $value );
		}

		$request->set_body(
			(string) wp_json_encode(
				$body + [
					'token' => $this->token(),
					'post' => $this->post,
					'hp' => '',
				]
			)
		);

		return $this->server->dispatch( $request );
	}

	/** @return array<string, string> */
	private function good(): array {
		return [
			'name' => 'Ada Lovelace',
			'email' => 'ada@example.com',
			'message' => "Hello <b>there</b>\nSecond line",
		];
	}

	/** @return list<array<string, mixed>> */
	private function entries(): array {
		$ids = get_posts(
			[
				'post_type' => Entries::POST_TYPE,
				'post_status' => 'any',
				'fields' => 'ids',
				'posts_per_page' => -1,
				'orderby' => 'ID',
				'order' => 'ASC',
			]
		);

		return array_values( array_filter( array_map( static fn ( $id ) => Entries::get( (int) $id ), $ids ) ) );
	}

	public function test_a_good_send_saves_an_entry_and_emails_it(): void {
		$fired = [];
		add_action(
			'blicks_form_sent',
			static function ( $entryId, $form, $values ) use ( &$fired ): void {
				$fired[] = [ $entryId, $form['settings']['uid'], $values ];
			},
			10,
			3
		);

		$response = $this->send( [ 'fields' => $this->good() ], [ 'referer' => home_url( '/contact/' ) ] );

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame(
			[
				'status' => 'sent',
				'message' => 'Thanks!',
			],
			$response->get_data()
		);

		$entries = $this->entries();
		$this->assertCount( 1, $entries );
		$entry = $entries[0];

		$this->assertSame( 'new', $entry['status'] );
		$this->assertSame( self::FORM, $entry['form'] );
		$this->assertSame( 'Contact', $entry['formTitle'] );
		$this->assertSame( $this->post, $entry['post'] );
		$this->assertSame( '/contact/', $entry['page'] );
		$this->assertSame( 'Ada Lovelace', $entry['fields']['name'] );
		$this->assertSame( "Hello there\nSecond line", $entry['fields']['message'] );
		$this->assertSame( 'Email', $entry['labels']['email'] );
		$this->assertMatchesRegularExpression( '/^[a-f0-9]{64}$/', $entry['ipHash'] );
		$this->assertStringNotContainsString( $_SERVER['REMOTE_ADDR'], (string) wp_json_encode( $entry ) );
		$this->assertSame( 'none', $entry['challenge'] );
		$this->assertSame( [ 'Saved', 'Emailed to owner@example.com' ], $entry['log'] );

		$this->assertCount( 1, $this->mails );
		$mail = $this->mails[0];
		$this->assertSame( [ 'owner@example.com' ], $mail['to'] );
		$this->assertSame( 'Hello from Ada Lovelace', $mail['subject'] );
		$this->assertContains( 'Reply-To: ada@example.com', $mail['headers'] );
		$this->assertStringContainsString( 'Ada Lovelace', $mail['message'] );
		$this->assertStringContainsString( 'page=blicks-entries#entries/' . $entry['id'], $mail['message'] );
		$this->assertStringNotContainsString( '<b>there</b>', $mail['message'] );

		$this->assertCount( 1, $fired );
		$this->assertSame( $entry['id'], $fired[0][0] );
	}

	public function test_the_email_escapes_and_the_subject_stays_one_line(): void {
		$this->send(
			[
				'fields' => [
					'name' => "Eve\r\nBcc: victim@example.com",
					'email' => 'eve@example.com',
					'message' => '<img src=x onerror=alert(1)>&<',
				],
			]
		);

		$this->assertCount( 1, $this->mails );
		$this->assertStringNotContainsString( "\n", $this->mails[0]['subject'] );
		$this->assertStringNotContainsString( "\r", $this->mails[0]['subject'] );
		$this->assertStringNotContainsString( '<img', $this->mails[0]['message'] );
	}

	public function test_the_request_cannot_add_fields_or_change_the_recipient(): void {
		$response = $this->send(
			[
				'fields' => $this->good() + [ 'is_admin' => 'yes' ],
				'email' => [ 'to' => 'attacker@example.com' ],
				'to' => 'attacker@example.com',
				'settings' => [ 'email' => [ 'to' => 'attacker@example.com' ] ],
			]
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertArrayNotHasKey( 'is_admin', $this->entries()[0]['fields'] );
		$this->assertSame( [ 'owner@example.com' ], $this->mails[0]['to'] );
	}

	public function test_errors_come_back_by_field_with_their_messages(): void {
		$response = $this->send(
			[
				'fields' => [
					'name' => '',
					'email' => 'nope',
				],
			]
		);

		$this->assertSame( 422, $response->get_status() );
		$this->assertSame( 'invalid', $response->get_data()['status'] );
		$this->assertSame(
			[
				'name' => 'Tell us your name.',
				'email' => 'Enter an email address like name@example.com.',
			],
			$response->get_data()['errors']
		);
		$this->assertSame( [], $this->entries() );
		$this->assertSame( [], $this->mails );
	}

	public function test_a_filled_trap_looks_sent_and_is_kept_as_spam(): void {
		$response = $this->send(
			[
				'fields' => $this->good(),
				'hp' => 'http://spam.example',
			]
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'sent', $response->get_data()['status'] );

		$entries = $this->entries();
		$this->assertCount( 1, $entries );
		$this->assertSame( 'spam', $entries[0]['status'] );
		$this->assertSame( [ 'Trap field filled' ], $entries[0]['notes'] );
		$this->assertSame( [], $this->mails );
	}

	public function test_a_post_without_javascript_is_spam_and_redirects(): void {
		$request = new WP_REST_Request( 'POST', '/blicks/v1/forms/' . self::FORM . '/entries' );
		$request->set_header( 'content-type', 'application/x-www-form-urlencoded' );
		$request->set_body_params( $this->good() + [ '_bl_hp' => '', '_bl_post' => (string) $this->post ] );

		$response = $this->server->dispatch( $request );

		$this->assertSame( 303, $response->get_status() );
		$location = $response->get_headers()['Location'];
		$this->assertStringStartsWith( get_permalink( $this->post ), $location );
		$this->assertStringContainsString( 'bl_form=' . self::FORM, $location );
		$this->assertStringEndsWith( '#blform-' . self::FORM, $location );

		$entries = $this->entries();
		$this->assertCount( 1, $entries );
		$this->assertSame( 'spam', $entries[0]['status'] );
		$this->assertSame( [ 'Sent without JavaScript' ], $entries[0]['notes'] );
		$this->assertSame( 'Ada Lovelace', $entries[0]['fields']['name'] );
		$this->assertSame( [], $this->mails );
	}

	public function test_the_sixth_send_in_a_minute_is_refused(): void {
		for ( $i = 1; $i <= 5; $i++ ) {
			$this->assertSame( 200, $this->send( [ 'fields' => $this->good() ] )->get_status(), "Send {$i}" );
		}

		$response = $this->send( [ 'fields' => $this->good() ] );
		$this->assertSame( 429, $response->get_status() );
		$this->assertSame( 'busy', $response->get_data()['status'] );

		// Someone else is not affected.
		$_SERVER['REMOTE_ADDR'] = '192.0.2.77';
		$this->assertSame( 200, $this->send( [ 'fields' => $this->good() ] )->get_status() );
	}

	public function test_a_form_that_is_not_in_the_post_is_missing(): void {
		$request = new WP_REST_Request( 'POST', '/blicks/v1/forms/deadbeef/entries' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( [ 'post' => $this->post ] ) );

		$response = $this->server->dispatch( $request );

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'missing', $response->get_data()['status'] );
	}

	public function test_another_site_is_refused(): void {
		$response = $this->send( [ 'fields' => $this->good() ], [ 'origin' => 'https://evil.example' ] );
		$this->assertSame( 403, $response->get_status() );

		$response = $this->send( [ 'fields' => $this->good() ], [ 'referer' => 'https://evil.example/page' ] );
		$this->assertSame( 403, $response->get_status() );

		$response = $this->send( [ 'fields' => $this->good() ], [ 'origin' => home_url() ] );
		$this->assertSame( 200, $response->get_status() );
	}

	public function test_a_form_that_does_not_save_still_emails(): void {
		$this->post = $this->page( [ 'save' => false ] );

		$this->assertSame( 200, $this->send( [ 'fields' => $this->good() ] )->get_status() );
		$this->assertSame( [], $this->entries() );
		$this->assertCount( 1, $this->mails );
	}

	public function test_no_recipient_falls_back_to_the_admin_email(): void {
		$this->post = $this->page(
			[
				'email' => [
					'on' => true,
					'to' => 'not-an-address, ',
				],
			]
		);

		$this->send( [ 'fields' => $this->good() ] );

		$this->assertSame( [ get_option( 'admin_email' ) ], $this->mails[0]['to'] );
		$this->assertSame( 'New entry: Contact', $this->mails[0]['subject'] );
	}

	public function test_a_signed_in_sender_is_recorded(): void {
		$user = self::factory()->user->create();
		wp_set_current_user( $user );

		$this->send( [ 'fields' => $this->good() ] );

		$this->assertSame( $user, $this->entries()[0]['user'] );
	}
}
