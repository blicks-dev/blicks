<?php
/**
 * The send token: signed, bound to its form and post, timed, single use.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Token;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

final class FormsTokenTest extends WP_UnitTestCase {

	private const FORM = 'b10c0001';

	private WP_REST_Server $server;

	private int $post;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;
		do_action( 'rest_api_init', $this->server );

		$_SERVER['REMOTE_ADDR'] = '203.0.113.' . wp_rand( 1, 250 );
		add_filter( 'pre_wp_mail', '__return_true' );

		$this->post = self::factory()->post->create(
			[
				'post_content' => '<!-- wp:blicks/form {"uniqueId":"' . self::FORM . '","spam":{"minSeconds":3}} -->'
					. '<!-- wp:blicks/field {"uniqueId":"aa11","type":"text","name":"name","label":"Name","required":true} /-->'
					. '<!-- /wp:blicks/form -->',
			]
		);
	}

	public function tear_down(): void {
		remove_filter( 'pre_wp_mail', '__return_true' );
		unset( $_SERVER['REMOTE_ADDR'] );
		parent::tear_down();
	}

	private function send( string $token, string $form = self::FORM ): int {
		$request = new WP_REST_Request( 'POST', '/blicks/v1/forms/' . $form . '/entries' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body(
			(string) wp_json_encode(
				[
					'token' => $token,
					'post' => $this->post,
					'fields' => [ 'name' => 'Ada' ],
					'hp' => '',
				]
			)
		);

		return $this->server->dispatch( $request )->get_status();
	}

	public function test_the_token_route_issues_a_token_that_is_not_cached(): void {
		$request = new WP_REST_Request( 'GET', '/blicks/v1/forms/' . self::FORM . '/token' );
		$request->set_param( 'post', $this->post );
		$response = $this->server->dispatch( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringContainsString( 'no-store', $response->get_headers()['Cache-Control'] );
		$this->assertMatchesRegularExpression( '/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $response->get_data()['token'] );
		$this->assertGreaterThan( time(), $response->get_data()['expires'] );
	}

	public function test_the_token_route_refuses_a_form_that_is_not_there(): void {
		$request = new WP_REST_Request( 'GET', '/blicks/v1/forms/ffffffff/token' );
		$request->set_param( 'post', $this->post );
		$response = $this->server->dispatch( $request );

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'blicks_form_missing', $response->get_data()['code'] );
	}

	public function test_a_good_token_sends_once(): void {
		$token = Token::issue( self::FORM, $this->post, time() - 10 )['token'];

		$this->assertSame( 200, $this->send( $token ) );
		$this->assertSame( 403, $this->send( $token ), 'A token is single use.' );
	}

	public function test_a_forged_token_is_refused(): void {
		$token = Token::issue( self::FORM, $this->post, time() - 10 )['token'];
		[ $payload ] = explode( '.', $token );

		$this->assertSame( 403, $this->send( $payload . '.' . str_repeat( 'A', 43 ) ) );
		$this->assertSame( 403, $this->send( 'garbage' ) );
		$this->assertSame( 403, $this->send( '' ) );

		// A payload re-signed with another key.
		$claims = rtrim( strtr( base64_encode( (string) wp_json_encode( [ 'f' => self::FORM, 'p' => $this->post, 't' => time() - 10, 'j' => str_repeat( 'a', 32 ) ] ) ), '+/', '-_' ), '=' );
		$sig = rtrim( strtr( base64_encode( hash_hmac( 'sha256', $claims, 'guess', true ) ), '+/', '-_' ), '=' );
		$this->assertSame( 403, $this->send( $claims . '.' . $sig ) );
	}

	public function test_a_token_for_another_form_or_post_is_refused(): void {
		$this->assertSame( 'mismatch', Token::check( Token::issue( 'b10c0002', $this->post, time() - 10 )['token'], self::FORM, $this->post, 3 ) );
		$this->assertSame( 'mismatch', Token::check( Token::issue( self::FORM, $this->post + 1, time() - 10 )['token'], self::FORM, $this->post, 3 ) );
		$this->assertSame( 403, $this->send( Token::issue( 'b10c0002', $this->post, time() - 10 )['token'] ) );
	}

	public function test_a_token_used_too_fast_is_refused(): void {
		$token = Token::issue( self::FORM, $this->post )['token'];

		$this->assertSame( 'early', Token::check( $token, self::FORM, $this->post, 3 ) );
		$this->assertSame( 403, $this->send( $token ) );

		// Not spent by the refusal: after the wait it works.
		$this->assertSame( '', Token::check( $token, self::FORM, $this->post, 3, time() + 5 ) );
	}

	public function test_an_expired_token_is_refused(): void {
		$token = Token::issue( self::FORM, $this->post, time() - Token::MAX_AGE - 1 )['token'];

		$this->assertSame( 'expired', Token::check( $token, self::FORM, $this->post, 3 ) );
		$this->assertSame( 403, $this->send( $token ) );
	}

	public function test_a_refused_send_does_not_spend_the_token(): void {
		$token = Token::issue( self::FORM, $this->post, time() - 10 )['token'];

		$request = new WP_REST_Request( 'POST', '/blicks/v1/forms/' . self::FORM . '/entries' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body(
			(string) wp_json_encode(
				[
					'token' => $token,
					'post' => $this->post,
					'fields' => [ 'name' => '' ],
				]
			)
		);

		$this->assertSame( 422, $this->server->dispatch( $request )->get_status() );
		$this->assertSame( 200, $this->send( $token ) );
	}
}
