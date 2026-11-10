<?php
/**
 * Renders a Form block.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

use Blicks\Style\ElementStyle;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Writes the `<form>` around a Form block's rendered inner blocks, exactly as the Form contract
 * (docs/blicks/plans/form-contracts.md) lays it out: the front-end behaviour reads this markup and
 * nothing else.
 *
 * The form is dynamic because kses has no `form` or `input`: everything here is written at render,
 * so the post id, REST URLs, the logged-in nonce and a challenge's site key can change without a
 * migration. Who is emailed and any secret stay on the server: nothing from `email` and nothing
 * from the challenge keys but the public site key reaches the page.
 */
final class FormRenderer {

	/** The query var a no-JS send returns with: `?bl_form=<uid>`. */
	public const SENT_FLAG = 'bl_form';

	/** @param array<string, mixed> $attributes */
	public static function render( array $attributes, string $content, mixed $block = null ): string {
		$settings = Schema::settings( $attributes );
		$uid = $settings['uid'];
		$props = ElementStyle::blockProps( $attributes['blicks'] ?? null, $uid, 'form' );
		// The error colour is a theme colour's slug, set as the var fields and messages read.
		if ( '' !== $settings['error'] ) {
			$props['style'] = trim( $props['style'] . ';--bl-form-error:var(--blicks-color-' . $settings['error'] . ')', ';' );
		}
		$class = $props['class'] . ' bl-form--' . $settings['look'] . ' bl-form--labels-' . $settings['labels'];
		$align = $attributes['align'] ?? '';
		if ( 'wide' === $align || 'full' === $align ) {
			$class .= ' align' . $align;
		}

		// No id means no address to send to: show the blocks, never a form that cannot work.
		if ( '' === $uid ) {
			return '<div' . self::attributes(
				[
					'class' => $class,
					'style' => $props['style'],
				]
			) . '>' . $content . '</div>';
		}

		$sent = self::returned( $uid );
		$post = self::postId( $block );
		$challenge = self::challenge( $settings['spam']['challenge'] );
		$id = 'blform-' . $uid;

		if ( 'none' !== $challenge ) {
			Challenge::enqueue( $challenge );
		}

		$context = [
			'form' => $uid,
			'post' => $post,
			'token' => add_query_arg( 'post', $post, rest_url( 'blicks/v1/forms/' . $uid . '/token' ) ),
			'entries' => rest_url( 'blicks/v1/forms/' . $uid . '/entries' ),
			// A nonce in a page a cache serves to everyone would be someone else's: logged-in only.
			'nonce' => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
			'after' => self::after( $settings['after'] ),
			'challenge' => [
				'kind' => $challenge,
				'siteKey' => 'none' === $challenge ? '' : Challenge::siteKey( $challenge ),
			],
			'minSeconds' => $settings['spam']['minSeconds'],
			'i18n' => self::strings(),
		];

		$open = '<form' . self::attributes(
			[
				'class' => $class . ' bl-form--marker-' . $settings['marker'] . ( $sent ? ' is-sent' : '' ),
				'style' => $props['style'],
				'id' => $id,
				'method' => 'post',
				'action' => esc_url( $context['entries'] ),
				'novalidate' => true,
				'data-wp-interactive' => 'blicks/form',
			]
		) . self::context( $context ) . self::attributes(
			[
				'data-wp-on--submit' => 'actions.submit',
				'data-wp-on--focusin' => 'actions.prime',
				'data-wp-on--input' => 'actions.edited',
				'data-wp-on--focusout' => 'actions.left',
				'data-wp-on--click' => 'actions.click',
				'data-wp-on--reset' => 'actions.reset',
				'data-wp-init' => 'callbacks.init',
			]
		) . '>';

		$title = '' !== $settings['after']['title'] ? $settings['after']['title'] : __( 'Thanks, your message is on its way', 'blicks' );
		$message = $settings['after']['message'];

		return $open
			. '<div class="bl-form__summary" id="' . esc_attr( $id . '-summary' ) . '" tabindex="-1" hidden></div>'
			. $content
			. self::challengeMarkup( $challenge )
			. '<p class="bl-form__retry" hidden></p>'
			. '<div class="bl-form__trap" aria-hidden="true"><label>' . esc_html__( 'Leave this field empty', 'blicks' )
			. '<input type="text" name="_bl_hp" value="" tabindex="-1" autocomplete="off"></label></div>'
			. '<input type="hidden" name="_bl_post" value="' . esc_attr( (string) $post ) . '">'
			. '<div class="bl-form__sent" id="' . esc_attr( $id . '-sent' ) . '" tabindex="-1" role="status"' . ( $sent ? '' : ' hidden' ) . '>'
			. '<p class="bl-form__sent-title">' . esc_html( $title ) . '</p>'
			. '<p class="bl-form__sent-text">' . nl2br( esc_html( $message ), false ) . '</p>'
			. '</div>'
			. '</form>';
	}

	/**
	 * The lowest reCAPTCHA v3 score this form passes: its own when the block saved one, else the
	 * site-wide default from Settings › Forms (Schema::settings() falls back to 0.5, which is not
	 * the site's choice).
	 *
	 * @param array<string, mixed> $attributes
	 */
	public static function minScore( array $attributes ): float {
		$spam = is_array( $attributes['spam'] ?? null ) ? $attributes['spam'] : [];

		return is_numeric( $spam['minScore'] ?? null )
			? Challenge::clampScore( (float) $spam['minScore'] )
			: Challenge::minScore();
	}

	/**
	 * The words the behaviour writes, translated here so the page's script needs no i18n.
	 *
	 * @return array<string, string>
	 */
	private static function strings(): array {
		return [
			'fix1' => __( '1 field needs a fix', 'blicks' ),
			/* translators: %d: number of fields with an error (2 or more) */
			'fixN' => __( '%d fields need a fix', 'blicks' ),
			'retry' => __( 'It could not be sent. Check your connection and try again.', 'blicks' ),
			'busy' => __( 'Too many sends just now. Wait a moment and try again.', 'blicks' ),
			'challenge' => __( 'Complete the check before sending.', 'blicks' ),
		];
	}

	/** True when this page load is the no-JS return from sending this form. */
	private static function returned( string $uid ): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only display flag: it only shows the sent message; nothing is stored or changed.
		$flag = isset( $_GET[ self::SENT_FLAG ] ) ? sanitize_key( wp_unslash( (string) $_GET[ self::SENT_FLAG ] ) ) : '';

		return '' !== $flag && $flag === $uid;
	}

	/** The post the form is in: the block's context, else the current post, else 0. */
	private static function postId( mixed $block ): int {
		$context = $block instanceof \WP_Block ? $block->context : ( is_object( $block ) && isset( $block->context ) && is_array( $block->context ) ? $block->context : [] );
		$id = is_numeric( $context['postId'] ?? null ) ? (int) $context['postId'] : 0;

		if ( $id <= 0 ) {
			$current = get_the_ID();
			$id = false === $current ? 0 : (int) $current;
		}

		return max( 0, $id );
	}

	/** A challenge is used only once its keys are set; otherwise the form runs without one. */
	private static function challenge( string $kind ): string {
		return 'none' !== $kind && Challenge::configured( $kind ) ? $kind : 'none';
	}

	/**
	 * What happens after sending, resolved for the page: a page id becomes its permalink, a dialog
	 * anchor its element id.
	 *
	 * @param array{kind: string, title: string, message: string, page: int, dialog: string} $after
	 * @return array{kind: string, url: string, dialog: string}
	 */
	private static function after( array $after ): array {
		$url = '';
		$dialog = '';

		if ( 'page' === $after['kind'] && $after['page'] > 0 && 'publish' === get_post_status( $after['page'] ) ) {
			$link = get_permalink( $after['page'] );
			$url = is_string( $link ) ? $link : '';
		}

		if ( 'dialog' === $after['kind'] && '' !== $after['dialog'] ) {
			$dialog = 'dialog-' . $after['dialog'];
		}

		return [
			'kind' => $after['kind'],
			'url' => $url,
			'dialog' => $dialog,
		];
	}

	/** The widget a visible challenge draws into, or the notice reCAPTCHA v3 asks for. */
	private static function challengeMarkup( string $kind ): string {
		if ( 'recaptcha-v2' === $kind || 'turnstile' === $kind ) {
			return '<div class="bl-form__challenge" data-bl-challenge="' . esc_attr( $kind ) . '"></div>';
		}

		if ( 'recaptcha-v3' !== $kind ) {
			return '';
		}

		$privacy = '<a href="' . esc_url( 'https://policies.google.com/privacy' ) . '">' . esc_html__( 'Privacy Policy', 'blicks' ) . '</a>';
		$terms = '<a href="' . esc_url( 'https://policies.google.com/terms' ) . '">' . esc_html__( 'Terms of Service', 'blicks' ) . '</a>';

		return '<p class="bl-form__notice">' . sprintf(
			/* translators: 1: "Privacy Policy" link, 2: "Terms of Service" link */
			esc_html__( 'This site is protected by reCAPTCHA. Google’s %1$s and %2$s apply.', 'blicks' ),
			$privacy,
			$terms
		) . '</p>';
	}

	/**
	 * The `data-wp-context` attribute, with a leading space.
	 *
	 * @param array<string, mixed> $context
	 */
	private static function context( array $context ): string {
		if ( function_exists( 'wp_interactivity_data_wp_context' ) ) {
			return ' ' . wp_interactivity_data_wp_context( $context );
		}

		$json = wp_json_encode( $context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES );

		return " data-wp-context='" . esc_attr( false === $json ? '{}' : $json ) . "'";
	}

	/**
	 * Attributes as HTML, each with a leading space; empty strings are left out, `true` is written
	 * bare.
	 *
	 * @param array<string, string|bool> $attributes
	 */
	private static function attributes( array $attributes ): string {
		$html = '';

		foreach ( $attributes as $name => $value ) {
			if ( true === $value ) {
				$html .= ' ' . $name;
			} elseif ( is_string( $value ) && '' !== $value ) {
				$html .= ' ' . $name . '="' . esc_attr( $value ) . '"';
			}
		}

		return $html;
	}
}
