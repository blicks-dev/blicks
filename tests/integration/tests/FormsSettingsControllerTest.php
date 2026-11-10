<?php
/**
 * Settings › Forms: administrators only, secrets write-only.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Challenge;
use WP_REST_Request;
use WP_REST_Server;
use WP_UnitTestCase;

final class FormsSettingsControllerTest extends WP_UnitTestCase {

	private WP_REST_Server $server;

	public function set_up(): void {
		parent::set_up();

		global $wp_rest_server;
		$wp_rest_server = new WP_REST_Server();
		$this->server = $wp_rest_server;
		do_action( 'rest_api_init', $this->server );

		delete_option( Challenge::OPTION );
	}

	/** @param array<string, mixed> $body */
	private function call( string $method, array $body = [] ): \WP_REST_Response {
		$request = new WP_REST_Request( $method, '/blicks/v1/forms/settings' );
		if ( [] !== $body ) {
			$request->set_header( 'Content-Type', 'application/json' );
			$request->set_body( (string) wp_json_encode( $body ) );
		}

		return $this->server->dispatch( $request );
	}

	private function admin(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}

	public function test_only_administrators_may_read_or_write(): void {
		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->call( 'GET' )->get_status() );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->assertSame( 403, $this->call( 'GET' )->get_status() );
		$this->assertSame( 403, $this->call( 'PATCH', [ 'turnstile' => [ 'siteKey' => 'x' ] ] )->get_status() );
		$this->assertFalse( get_option( Challenge::OPTION ) );
	}

	public function test_get_defaults(): void {
		$this->admin();

		$data = $this->call( 'GET' )->get_data();

		$this->assertSame(
			[
				'recaptchaV3' => [
					'siteKey' => '',
					'hasSecret' => false,
				],
				'recaptchaV2' => [
					'siteKey' => '',
					'hasSecret' => false,
				],
				'turnstile' => [
					'siteKey' => '',
					'hasSecret' => false,
				],
				'minScore' => 0.5,
			],
			$data
		);
	}

	public function test_secrets_are_write_only_and_kept_when_omitted(): void {
		$this->admin();

		$response = $this->call(
			'PATCH',
			[
				'recaptchaV3' => [
					'siteKey' => '6Lc<script>abc_-',
					'secret' => 'top-secret',
				],
				'minScore' => 0.7,
			]
		);

		$this->assertSame( 200, $response->get_status() );
		$this->assertStringNotContainsString( 'top-secret', (string) wp_json_encode( $response->get_data() ) );
		$this->assertSame(
			[
				'siteKey' => '6Lcscriptabc_-',
				'hasSecret' => true,
			],
			$response->get_data()['recaptchaV3']
		);
		$this->assertSame( 0.7, $response->get_data()['minScore'] );

		// The GET never carries a secret either.
		$this->assertStringNotContainsString( 'top-secret', (string) wp_json_encode( $this->call( 'GET' )->get_data() ) );

		// Empty or omitted secret keeps the stored one; the site key may change on its own.
		$this->call( 'PATCH', [ 'recaptchaV3' => [ 'siteKey' => 'new-key', 'secret' => '' ] ] );
		$this->call( 'PATCH', [ 'recaptchaV3' => [ 'siteKey' => 'new-key' ] ] );

		$keys = Challenge::keys()['recaptcha-v3'];
		$this->assertSame( 'new-key', $keys['siteKey'] );
		$this->assertSame( 'top-secret', $keys['secret'] );
		$this->assertTrue( Challenge::configured( 'recaptcha-v3' ) );
		$this->assertSame( 0.7, Challenge::minScore() );

		// Not autoloaded.
		global $wpdb;
		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Challenge::OPTION ) );
		$this->assertContains( $autoload, [ 'no', 'off' ] );
	}

	public function test_clear_removes_both_keys_of_one_provider(): void {
		$this->admin();

		$this->call(
			'PATCH',
			[
				'recaptchaV2' => [
					'siteKey' => 'v2key',
					'secret' => 'v2secret',
				],
				'turnstile' => [
					'siteKey' => 'tkey',
					'secret' => 'tsecret',
				],
			]
		);

		$data = $this->call( 'PATCH', [ 'turnstile' => [ 'clear' => true ] ] )->get_data();

		$this->assertSame(
			[
				'siteKey' => '',
				'hasSecret' => false,
			],
			$data['turnstile']
		);
		$this->assertFalse( Challenge::configured( 'turnstile' ) );
		$this->assertTrue( Challenge::configured( 'recaptcha-v2' ) );
	}

	public function test_min_score_out_of_range_is_rejected(): void {
		$this->admin();

		$this->assertSame( 400, $this->call( 'PATCH', [ 'minScore' => 2 ] )->get_status() );
		$this->assertSame( 0.5, Challenge::minScore() );
	}
}
