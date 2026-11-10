<?php
/**
 * Spam challenges: provider verification outcomes and conditional script loading.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Challenge;
use WP_Error;
use WP_UnitTestCase;

final class ChallengeTest extends WP_UnitTestCase {

	/** @var list<array{url: string, args: array<string, mixed>}> */
	private array $requests = [];

	/** @var array<string, mixed>|WP_Error */
	private $reply = [];

	public function set_up(): void {
		parent::set_up();

		delete_option( Challenge::OPTION );
		$this->requests = [];

		add_filter( 'pre_http_request', [ $this, 'mock' ], 10, 3 );
	}

	public function tear_down(): void {
		remove_filter( 'pre_http_request', [ $this, 'mock' ], 10 );

		foreach ( [ 'blicks-recaptcha', 'blicks-turnstile' ] as $handle ) {
			wp_dequeue_script( $handle );
			wp_deregister_script( $handle );
		}

		parent::tear_down();
	}

	/**
	 * @param false|array<string, mixed>|WP_Error $pre
	 * @param array<string, mixed>                $args
	 * @return array<string, mixed>|WP_Error
	 */
	public function mock( $pre, array $args, string $url ) {
		unset( $pre );
		$this->requests[] = [
			'url' => $url,
			'args' => $args,
		];

		return $this->reply;
	}

	/** @param array<string, mixed> $json */
	private function replyWith( array $json, int $code = 200 ): void {
		$this->reply = [
			'headers' => [],
			'body' => (string) wp_json_encode( $json ),
			'response' => [
				'code' => $code,
				'message' => 'OK',
			],
			'cookies' => [],
		];
	}

	private function configure( string $kind ): void {
		$stored = get_option( Challenge::OPTION, [] );
		$stored[ $kind ] = [
			'siteKey' => 'site-key_123',
			'secret' => 'secret-456',
		];
		update_option( Challenge::OPTION, $stored, false );
	}

	private function host(): string {
		return (string) wp_parse_url( home_url(), PHP_URL_HOST );
	}

	public function test_not_configured_is_unchecked_and_calls_nobody(): void {
		$result = Challenge::verify( 'turnstile', 'token', 0.5 );

		$this->assertSame( 'unchecked', $result['result'] );
		$this->assertSame( 'Challenge not checked', $result['note'] );
		$this->assertSame( [], $this->requests );
		$this->assertFalse( Challenge::configured( 'turnstile' ) );
		$this->assertSame( '', Challenge::siteKey( 'turnstile' ) );
	}

	public function test_unknown_kind_is_unchecked(): void {
		$this->assertSame( 'unchecked', Challenge::verify( 'none', 'token', 0.5 )['result'] );
	}

	public function test_empty_token_fails(): void {
		$this->configure( 'recaptcha-v2' );

		$result = Challenge::verify( 'recaptcha-v2', '  ', 0.5 );

		$this->assertSame( 'fail', $result['result'] );
		$this->assertSame( 'Challenge missing', $result['note'] );
		$this->assertSame( [], $this->requests );
	}

	public function test_v3_success_passes_with_score_and_sends_no_ip(): void {
		$this->configure( 'recaptcha-v3' );
		$this->replyWith(
			[
				'success' => true,
				'score' => 0.9,
				'action' => 'blicks_form',
				'hostname' => $this->host(),
			]
		);

		$result = Challenge::verify( 'recaptcha-v3', 'tok', 0.5 );

		$this->assertSame( 'pass', $result['result'] );
		$this->assertSame( 0.9, $result['score'] );
		$this->assertCount( 1, $this->requests );
		$this->assertSame( 'https://www.google.com/recaptcha/api/siteverify', $this->requests[0]['url'] );
		$this->assertSame( 'POST', $this->requests[0]['args']['method'] );
		$this->assertSame( 5, $this->requests[0]['args']['timeout'] );
		$this->assertSame(
			[
				'secret' => 'secret-456',
				'response' => 'tok',
			],
			$this->requests[0]['args']['body']
		);
	}

	public function test_v3_low_score_fails(): void {
		$this->configure( 'recaptcha-v3' );
		$this->replyWith(
			[
				'success' => true,
				'score' => 0.3,
				'action' => 'blicks_form',
				'hostname' => $this->host(),
			]
		);

		$result = Challenge::verify( 'recaptcha-v3', 'tok', 0.5 );

		$this->assertSame( 'fail', $result['result'] );
		$this->assertSame( 'Low reCAPTCHA score (0.3)', $result['note'] );
		$this->assertSame( 0.3, $result['score'] );
	}

	public function test_v3_wrong_action_fails(): void {
		$this->configure( 'recaptcha-v3' );
		$this->replyWith(
			[
				'success' => true,
				'score' => 0.9,
				'action' => 'login',
				'hostname' => $this->host(),
			]
		);

		$this->assertSame( 'fail', Challenge::verify( 'recaptcha-v3', 'tok', 0.5 )['result'] );
	}

	public function test_wrong_hostname_fails(): void {
		$this->configure( 'turnstile' );
		$this->replyWith(
			[
				'success' => true,
				'hostname' => 'evil.example.net',
			]
		);

		$result = Challenge::verify( 'turnstile', 'tok', 0.5 );

		$this->assertSame( 'fail', $result['result'] );
		$this->assertSame( 'https://challenges.cloudflare.com/turnstile/v0/siteverify', $this->requests[0]['url'] );
	}

	public function test_turnstile_success_passes(): void {
		$this->configure( 'turnstile' );
		$this->replyWith(
			[
				'success' => true,
				'hostname' => $this->host(),
			]
		);

		$this->assertSame( [ 'result' => 'pass' ], Challenge::verify( 'turnstile', 'tok', 0.5 ) );
	}

	public function test_provider_rejection_fails(): void {
		$this->configure( 'recaptcha-v2' );
		$this->replyWith(
			[
				'success' => false,
				'error-codes' => [ 'invalid-input-response' ],
			]
		);

		$this->assertSame( 'fail', Challenge::verify( 'recaptcha-v2', 'tok', 0.5 )['result'] );
	}

	public function test_wrong_secret_is_unchecked(): void {
		$this->configure( 'recaptcha-v2' );
		$this->replyWith(
			[
				'success' => false,
				'error-codes' => [ 'invalid-input-secret' ],
			]
		);

		$this->assertSame( 'unchecked', Challenge::verify( 'recaptcha-v2', 'tok', 0.5 )['result'] );
	}

	public function test_network_error_is_unchecked(): void {
		$this->configure( 'turnstile' );
		$this->reply = new WP_Error( 'http_request_failed', 'timed out' );

		$result = Challenge::verify( 'turnstile', 'tok', 0.5 );

		$this->assertSame( 'unchecked', $result['result'] );
		$this->assertSame( 'Challenge not checked', $result['note'] );
	}

	public function test_non_200_and_invalid_json_are_unchecked(): void {
		$this->configure( 'turnstile' );

		$this->replyWith( [ 'success' => true ], 500 );
		$this->assertSame( 'unchecked', Challenge::verify( 'turnstile', 'tok', 0.5 )['result'] );

		$this->replyWith( [] );
		$this->reply['body'] = '<html>nope';
		$this->assertSame( 'unchecked', Challenge::verify( 'turnstile', 'tok', 0.5 )['result'] );
	}

	public function test_enqueue_does_nothing_when_not_configured(): void {
		Challenge::enqueue( 'recaptcha-v3' );
		Challenge::enqueue( 'turnstile' );

		$this->assertFalse( wp_script_is( 'blicks-recaptcha', 'enqueued' ) );
		$this->assertFalse( wp_script_is( 'blicks-turnstile', 'enqueued' ) );
	}

	public function test_enqueue_loads_the_provider_script_in_the_footer(): void {
		$this->configure( 'recaptcha-v3' );
		$this->configure( 'turnstile' );

		Challenge::enqueue( 'recaptcha-v3' );
		Challenge::enqueue( 'turnstile' );

		$this->assertTrue( wp_script_is( 'blicks-recaptcha', 'enqueued' ) );
		$this->assertTrue( wp_script_is( 'blicks-turnstile', 'enqueued' ) );

		$recaptcha = wp_scripts()->query( 'blicks-recaptcha', 'registered' );
		$this->assertSame( 'https://www.google.com/recaptcha/api.js?render=site-key_123', $recaptcha->src );
		$this->assertNull( $recaptcha->ver );
		$this->assertSame( 1, wp_scripts()->get_data( 'blicks-recaptcha', 'group' ) );
		$this->assertSame( 'defer', wp_scripts()->get_data( 'blicks-recaptcha', 'strategy' ) );

		$turnstile = wp_scripts()->query( 'blicks-turnstile', 'registered' );
		$this->assertSame( 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', $turnstile->src );
	}

	public function test_v3_replaces_an_earlier_v2_script_on_the_same_page(): void {
		$this->configure( 'recaptcha-v2' );
		$this->configure( 'recaptcha-v3' );

		Challenge::enqueue( 'recaptcha-v2' );
		$this->assertSame( 'https://www.google.com/recaptcha/api.js?render=explicit', wp_scripts()->query( 'blicks-recaptcha', 'registered' )->src );

		Challenge::enqueue( 'recaptcha-v3' );
		Challenge::enqueue( 'recaptcha-v2' );
		$this->assertSame( 'https://www.google.com/recaptcha/api.js?render=site-key_123', wp_scripts()->query( 'blicks-recaptcha', 'registered' )->src );
		$this->assertTrue( wp_script_is( 'blicks-recaptcha', 'enqueued' ) );
	}
}
