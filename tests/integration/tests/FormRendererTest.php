<?php
/**
 * What the Form block writes on the page: the contract's `<form>`, its context, and nothing secret.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Challenge;
use Blicks\Forms\FormRenderer;
use WP_UnitTestCase;

final class FormRendererTest extends WP_UnitTestCase {

	public function tear_down(): void {
		unset( $_GET['bl_form'] );
		delete_option( Challenge::OPTION );
		wp_set_current_user( 0 );
		parent::tear_down();
	}

	/** @param array<string, mixed> $attrs */
	private static function form( array $attrs = [], string $inner = '' ): string {
		$attrs += [ 'uniqueId' => 'ab12cd34' ];

		return '<!-- wp:blicks/form ' . wp_json_encode( $attrs ) . ' -->' . $inner . '<!-- /wp:blicks/form -->';
	}

	/** @return array<string, mixed> The decoded `data-wp-context` of the first form. */
	private static function context( string $html ): array {
		$p = new \WP_HTML_Tag_Processor( $html );
		self::assertTrue( $p->next_tag( 'form' ) );
		$raw = $p->get_attribute( 'data-wp-context' );
		self::assertIsString( $raw );
		$context = json_decode( $raw, true );
		self::assertIsArray( $context );

		return $context;
	}

	public function test_the_form_tag_carries_the_contract_attributes(): void {
		$post = self::factory()->post->create();
		$GLOBALS['post'] = get_post( $post );
		setup_postdata( $GLOBALS['post'] );

		$html = do_blocks( self::form( [ 'look' => 'outlined', 'labels' => 'inside' ], '<!-- wp:blicks/text {"content":"Hello"} --><p class="bl-text">Hello</p><!-- /wp:blicks/text -->' ) );
		wp_reset_postdata();

		$p = new \WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $p->next_tag( 'form' ) );
		$classes = explode( ' ', (string) $p->get_attribute( 'class' ) );
		foreach ( [ 'bl-form', 'bl-ab12cd34', 'bl-form--outlined', 'bl-form--labels-inside' ] as $class ) {
			$this->assertContains( $class, $classes );
		}
		$this->assertSame( 'blform-ab12cd34', $p->get_attribute( 'id' ) );
		$this->assertSame( 'post', $p->get_attribute( 'method' ) );
		$this->assertSame( rest_url( 'blicks/v1/forms/ab12cd34/entries' ), $p->get_attribute( 'action' ) );
		$this->assertTrue( $p->get_attribute( 'novalidate' ) );
		$this->assertSame( 'blicks/form', $p->get_attribute( 'data-wp-interactive' ) );
		$this->assertSame( 'actions.submit', $p->get_attribute( 'data-wp-on--submit' ) );
		$this->assertSame( 'actions.prime', $p->get_attribute( 'data-wp-on--focusin' ) );
		$this->assertSame( 'actions.edited', $p->get_attribute( 'data-wp-on--input' ) );
		$this->assertSame( 'actions.left', $p->get_attribute( 'data-wp-on--focusout' ) );
		$this->assertSame( 'callbacks.init', $p->get_attribute( 'data-wp-init' ) );
		$this->assertSame( 'actions.click', $p->get_attribute( 'data-wp-on--click' ) );
		$this->assertSame( 'actions.reset', $p->get_attribute( 'data-wp-on--reset' ) );
		$this->assertContains( 'bl-form--marker-optional', $classes );
		$this->assertNotContains( 'alignwide', $classes );

		$context = self::context( $html );
		$this->assertSame( 'ab12cd34', $context['form'] );
		$this->assertSame( $post, $context['post'] );
		$this->assertSame( add_query_arg( 'post', $post, rest_url( 'blicks/v1/forms/ab12cd34/token' ) ), $context['token'] );
		$this->assertSame( rest_url( 'blicks/v1/forms/ab12cd34/entries' ), $context['entries'] );
		$this->assertSame( [ 'kind' => 'message', 'url' => '', 'dialog' => '' ], $context['after'] );
		$this->assertSame( [ 'kind' => 'none', 'siteKey' => '' ], $context['challenge'] );

		// The parts, in order, around the inner blocks.
		$this->assertMatchesRegularExpression( '#<div class="bl-form__summary" id="blform-ab12cd34-summary" tabindex="-1" hidden></div><p class="bl-text[^"]*">Hello</p><p class="bl-form__retry" hidden></p>#', $html );
		$this->assertStringContainsString( '<div class="bl-form__trap" aria-hidden="true"><label>Leave this field empty<input type="text" name="_bl_hp" value="" tabindex="-1" autocomplete="off"></label></div>', $html );
		$this->assertStringContainsString( '<input type="hidden" name="_bl_post" value="' . $post . '">', $html );
		$this->assertStringContainsString( '<div class="bl-form__sent" id="blform-ab12cd34-sent" tabindex="-1" role="status" hidden><p class="bl-form__sent-title">Thanks, your message is on its way</p><p class="bl-form__sent-text"></p></div></form>', $html );
		$this->assertStringNotContainsString( 'is-sent', $html );
	}

	public function test_the_error_colour_is_a_theme_colour_var(): void {
		$html = do_blocks( self::form( [ 'errorColour' => 'destructive' ] ) );
		$p = new \WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $p->next_tag( 'form' ) );
		$this->assertStringContainsString( '--bl-form-error:var(--blicks-color-destructive)', (string) $p->get_attribute( 'style' ) );

		$html = do_blocks( self::form( [ 'errorColour' => 'red;}body{x' ] ) );
		$this->assertStringNotContainsString( '}body{', $html );
	}

	public function test_the_context_carries_the_wait_and_the_translated_strings(): void {
		$context = self::context( FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'spam' => [ 'minSeconds' => 7 ] ], '' ) );

		$this->assertSame( 7, $context['minSeconds'] );
		$this->assertSame(
			[
				'fix1' => '1 field needs a fix',
				'fixN' => '%d fields need a fix',
				'retry' => 'It could not be sent. Check your connection and try again.',
				'busy' => 'Too many sends just now. Wait a moment and try again.',
				'challenge' => 'Complete the check before sending.',
			],
			$context['i18n']
		);
		$this->assertSame( 3, self::context( FormRenderer::render( [ 'uniqueId' => 'ab12cd34' ], '' ) )['minSeconds'] );
	}

	public function test_min_score_falls_back_to_the_site_default(): void {
		update_option( Challenge::OPTION, [ 'minScore' => 0.7 ] );

		$this->assertSame( 0.7, FormRenderer::minScore( [ 'uniqueId' => 'ab12cd34' ] ) );
		$this->assertSame( 0.7, FormRenderer::minScore( [ 'spam' => [ 'challenge' => 'recaptcha-v3' ] ] ) );
		$this->assertSame( 0.3, FormRenderer::minScore( [ 'spam' => [ 'minScore' => 0.3 ] ] ) );
		$this->assertSame( 1.0, FormRenderer::minScore( [ 'spam' => [ 'minScore' => 4 ] ] ) );
	}

	public function test_the_post_comes_from_block_context(): void {
		$block = new \WP_Block( [ 'blockName' => 'blicks/form', 'attrs' => [ 'uniqueId' => 'ab12cd34' ], 'innerBlocks' => [], 'innerHTML' => '', 'innerContent' => [] ], [ 'postId' => 77 ] );
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34' ], '', $block );

		$this->assertSame( 77, self::context( $html )['post'] );
		$this->assertStringContainsString( 'name="_bl_post" value="77"', $html );
	}

	public function test_no_email_address_or_secret_reaches_the_page(): void {
		update_option(
			Challenge::OPTION,
			[
				'turnstile' => [
					'siteKey' => 'public-site-key',
					'secret' => 'very-secret-value',
				],
			]
		);

		$html = FormRenderer::render(
			[
				'uniqueId' => 'ab12cd34',
				'email' => [
					'on' => true,
					'to' => 'owner@example.com, sales@example.com',
					'subject' => 'Hello {email}',
				],
				'spam' => [ 'challenge' => 'turnstile' ],
			],
			''
		);

		$this->assertStringNotContainsString( 'owner@example.com', $html );
		$this->assertStringNotContainsString( 'sales@example.com', $html );
		$this->assertStringNotContainsString( 'very-secret-value', $html );
		$this->assertStringNotContainsString( 'Hello {email}', $html );
		$this->assertSame( [ 'kind' => 'turnstile', 'siteKey' => 'public-site-key' ], self::context( $html )['challenge'] );
		$this->assertStringContainsString( '<div class="bl-form__challenge" data-bl-challenge="turnstile"></div>', $html );
	}

	public function test_a_challenge_without_keys_is_not_used(): void {
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'spam' => [ 'challenge' => 'recaptcha-v2' ] ], '' );

		$this->assertSame( [ 'kind' => 'none', 'siteKey' => '' ], self::context( $html )['challenge'] );
		$this->assertStringNotContainsString( 'bl-form__challenge', $html );
	}

	public function test_recaptcha_v3_writes_the_notice(): void {
		update_option( Challenge::OPTION, [ 'recaptcha-v3' => [ 'siteKey' => 'v3-key', 'secret' => 's' ] ] );

		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'spam' => [ 'challenge' => 'recaptcha-v3' ] ], '' );

		$this->assertStringContainsString( '<p class="bl-form__notice">This site is protected by reCAPTCHA.', $html );
		$this->assertStringContainsString( 'href="https://policies.google.com/privacy"', $html );
		$this->assertStringContainsString( 'href="https://policies.google.com/terms"', $html );
		$this->assertStringNotContainsString( 'bl-form__challenge', $html );
	}

	public function test_the_nonce_is_written_only_for_a_logged_in_user(): void {
		$this->assertSame( '', self::context( FormRenderer::render( [ 'uniqueId' => 'ab12cd34' ], '' ) )['nonce'] );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );
		$nonce = self::context( FormRenderer::render( [ 'uniqueId' => 'ab12cd34' ], '' ) )['nonce'];

		$this->assertNotSame( '', $nonce );
		$this->assertSame( 1, wp_verify_nonce( $nonce, 'wp_rest' ) );
	}

	public function test_after_sending_resolves_a_page_to_its_permalink(): void {
		$page = self::factory()->post->create( [ 'post_type' => 'page' ] );
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'after' => [ 'kind' => 'page', 'page' => $page ] ], '' );

		$this->assertSame( [ 'kind' => 'page', 'url' => get_permalink( $page ), 'dialog' => '' ], self::context( $html )['after'] );
	}

	public function test_a_draft_page_is_not_linked(): void {
		$page = self::factory()->post->create(
			[
				'post_type' => 'page',
				'post_status' => 'draft',
			]
		);
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'after' => [ 'kind' => 'page', 'page' => $page ] ], '' );

		$this->assertSame( '', self::context( $html )['after']['url'] );
	}

	public function test_after_sending_resolves_a_dialog_to_its_id(): void {
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'after' => [ 'kind' => 'dialog', 'dialog' => 'thanks' ] ], '' );
		$this->assertSame( [ 'kind' => 'dialog', 'url' => '', 'dialog' => 'dialog-thanks' ], self::context( $html )['after'] );

		$prefixed = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'after' => [ 'kind' => 'dialog', 'dialog' => 'dialog-thanks' ] ], '' );
		$this->assertSame( 'dialog-thanks', self::context( $prefixed )['after']['dialog'] );
	}

	public function test_the_no_js_return_shows_the_sent_message(): void {
		$_GET['bl_form'] = 'ab12cd34';
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34', 'after' => [ 'title' => 'Got it', 'message' => 'We reply soon.' ] ], '' );

		$p = new \WP_HTML_Tag_Processor( $html );
		$p->next_tag( 'form' );
		$this->assertTrue( $p->has_class( 'is-sent' ) );
		$this->assertStringContainsString( '<div class="bl-form__sent" id="blform-ab12cd34-sent" tabindex="-1" role="status"><p class="bl-form__sent-title">Got it</p><p class="bl-form__sent-text">We reply soon.</p></div>', $html );
	}

	public function test_the_no_js_flag_for_another_form_changes_nothing(): void {
		$_GET['bl_form'] = 'other999';
		$html = FormRenderer::render( [ 'uniqueId' => 'ab12cd34' ], '' );

		$this->assertStringNotContainsString( 'is-sent', $html );
		$this->assertStringContainsString( 'role="status" hidden>', $html );
	}

	public function test_a_form_without_an_id_is_a_plain_div(): void {
		$html = FormRenderer::render( [], '<p>Inner</p>' );

		$this->assertStringStartsWith( '<div class="bl-form bl-form--filled bl-form--labels-above">', $html );
		$this->assertStringEndsWith( '<p>Inner</p></div>', $html );
		$this->assertStringNotContainsString( '<form', $html );
		$this->assertStringNotContainsString( 'data-wp-interactive', $html );

		$bad = FormRenderer::render( [ 'uniqueId' => 'Not An Id"' ], '' );
		$this->assertStringNotContainsString( '<form', $bad );
	}

	public function test_author_text_is_escaped(): void {
		$html = FormRenderer::render(
			[
				'uniqueId' => 'ab12cd34',
				'look' => '"><script>',
				'after' => [
					'title' => 'Thanks <b>"you"</b>',
					'message' => "Line one & <i>two</i>\nLine three",
				],
			],
			''
		);

		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringNotContainsString( '<b>', $html );
		$this->assertStringNotContainsString( '<i>', $html );
		$this->assertStringContainsString( 'bl-form--filled', $html );
		$this->assertStringContainsString( "Line one &amp; two<br>\nLine three", $html );

		$context = self::context( $html );
		$this->assertSame( 'ab12cd34', $context['form'] );
	}

	/** @return list<string> The classes of the first form (or the id-less div). */
	private static function classes( string $html, string $tag = 'form' ): array {
		$p = new \WP_HTML_Tag_Processor( $html );
		self::assertTrue( $p->next_tag( $tag ) );

		return explode( ' ', (string) $p->get_attribute( 'class' ) );
	}

	public function test_the_marker_is_a_class_of_the_form(): void {
		foreach ( [ 'required', 'both', 'none' ] as $marker ) {
			$this->assertContains( 'bl-form--marker-' . $marker, self::classes( do_blocks( self::form( [ 'marker' => $marker ] ) ) ) );
		}
		$this->assertContains( 'bl-form--marker-optional', self::classes( do_blocks( self::form( [ 'marker' => 'bogus' ] ) ) ) );
	}

	public function test_a_wide_or_full_form_is_aligned(): void {
		$this->assertContains( 'alignwide', self::classes( do_blocks( self::form( [ 'align' => 'wide' ] ) ) ) );
		$this->assertContains( 'alignfull', self::classes( do_blocks( self::form( [ 'align' => 'full' ] ) ) ) );
		$this->assertNotContains( 'alignleft', self::classes( do_blocks( self::form( [ 'align' => 'left' ] ) ) ) );
		$this->assertContains( 'alignwide', self::classes( do_blocks( self::form( [ 'uniqueId' => '', 'align' => 'wide' ] ) ), 'div' ) );
	}
}
