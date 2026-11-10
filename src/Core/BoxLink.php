<?php
/**
 * The accessible name of a linked Box's overlay link.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A linked Box is a card with an empty `<a class="bl-box__link">` stretched over it. Saved
 * without a link label, that link has no text, so a screen reader announces only "link". This
 * names it at render time from what the card says: its first heading, or failing that its text.
 * The saved markup is untouched, so posts already saved need no migration, and a label the
 * author set always wins.
 */
final class BoxLink {

	/** Long enough for a heading or a short sentence; a whole card read twice helps nobody. */
	private const MAX = 100;

	/** The overlay is the wrapper's first child, so a nested card's own overlay is never this one. */
	private const OVERLAY = '/^(\s*<[a-z][a-z0-9]*\b[^>]*>\s*)<a class="bl-box__link"([^>]*)>(\s*<\/a>)/i';

	/** The Box's rendered HTML, with its overlay link named when the author left the label empty. */
	public static function withName( string $html ): string {
		if ( ! preg_match( self::OVERLAY, $html, $m, PREG_OFFSET_CAPTURE ) ) {
			return $html;
		}

		$attributes = $m[2][0];

		if ( preg_match( '/\saria-label(?:ledby)?="[^"]*\S[^"]*"/i', $attributes ) ) {
			return $html;
		}

		$name = self::nameFrom( substr( $html, strlen( $m[0][0] ) ) );

		if ( '' === $name ) {
			return $html;
		}

		$attributes = (string) preg_replace( '/\saria-label=""/i', '', $attributes );
		$link       = '<a class="bl-box__link"' . $attributes . ' aria-label="' . esc_attr( $name ) . '">';

		return $m[1][0] . $link . $m[3][0] . substr( $html, strlen( $m[0][0] ) );
	}

	/** The card's first heading, else all its text, as plain words. */
	public static function nameFrom( string $content ): string {
		$source = preg_match( '/<h[1-6]\b[^>]*>(.*?)<\/h[1-6]>/is', $content, $h ) ? $h[1] : $content;
		// Tags become spaces first, so words in neighbouring elements do not run together.
		$text = html_entity_decode( wp_strip_all_tags( (string) preg_replace( '/<[^>]+>/', ' ', $source ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$text = trim( (string) preg_replace( '/\s+/u', ' ', $text ) );

		if ( mb_strlen( $text ) <= self::MAX ) {
			return $text;
		}

		$cut  = mb_substr( $text, 0, self::MAX );
		$word = mb_strrpos( $cut, ' ' );

		return rtrim( false !== $word && $word > self::MAX / 2 ? mb_substr( $cut, 0, $word ) : $cut, ' ,.;:' ) . '…';
	}
}
