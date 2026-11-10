<?php
/**
 * What the header blocks need from the page they are rendered on.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

use WP_HTML_Tag_Processor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The header blocks save plain, semantic markup: a `<header>`, a `<nav aria-label>` with a `<ul>`,
 * menu items that are links or `aria-expanded` buttons. Everything that makes it work is written
 * here, at render, so it can change without touching saved headers:
 *
 *  - **The phone drawer.** After the menu's list comes an empty `blicks/dialog` in its drawer kind,
 *    rendered through `render_block()` like any Dialog block, so the free plugin names it, gives it
 *    the `dialog` behaviour and loads that only here. A menu button opens it with the browser's
 *    invoker commands, and the list carries the free `portal` behaviour, which moves it into the
 *    drawer while the drawer is open and back on close. So on wide screens there is no dialog in the
 *    accessibility tree, only the navigation and its list. Focus trap, Esc, scroll lock and focus
 *    return are the dialog's. Without the script the button stays hidden and narrow screens show
 *    the list in place, stacked.
 *  - **Mega menus**, after the WAI-ARIA disclosure navigation pattern: the item's button gets
 *    `aria-controls`, its panel an id, and the item the `disclosure` behaviour's directives, plus
 *    `hover-intent`'s when the panel opens on hover. A Back button and the item's name lead the
 *    panel, for the drawer's next screen.
 *  - **Scrolling.** A header that shrinks, sits clear over the first section or hides while the
 *    page scrolls down gets the `sticky-shrink` behaviour; one that hides also opts in to its
 *    `data-bl-hidden`, which the stylesheet turns into sliding up out of view.
 *
 * Runs on `render_block` at 30: after a block's own markup, before the behaviour registry reads
 * the page at 100, so every behaviour named here is loaded.
 */
final class Render {

	/**
	 * @param array<string, mixed> $block
	 */
	public static function block( string $html, array $block ): string {
		switch ( $block['blockName'] ?? '' ) {
			case 'blicks/header':
				return self::header( self::withoutEmpty( $html ) );
			case 'blicks/nav':
				return self::nav( $html, self::attrs( $block ) );
			case 'blicks/nav-item':
				return self::navItem( $html, $block );
			case 'core/template-part':
				return self::part( $html );
		}

		return $html;
	}

	/**
	 * A header template part is wrapped in core's `<header class="wp-block-template-part">`. Around a
	 * Header block that is a second `<header>`, a second banner landmark: the wrapper becomes a
	 * `<div>`, and the Header block is the page's one header. A theme that places the part wide
	 * (Twenty Twenty-Two) gets it full width: the Header lines its rows up to the content width itself,
	 * and its background belongs edge to edge.
	 */
	public static function part( string $html ): string {
		$html = ltrim( $html );

		// The Header's own attributes may come in any order (its behaviour's are written first).
		if ( 1 !== preg_match( '/<header\b[^>]*\bclass="bl-header\b/', $html ) || 1 !== preg_match( '/^<header(\s[^>]*)?>/', $html, $open ) ) {
			return $html;
		}

		$p = new WP_HTML_Tag_Processor( $open[0] );

		if ( ! $p->next_tag( 'HEADER' ) || ! $p->has_class( 'wp-block-template-part' ) ) {
			return $html;
		}

		$end = strrpos( $html, '</header>' );

		if ( false === $end || $end < strlen( $open[0] ) ) {
			return $html;
		}

		$p->add_class( 'bl-header-part' );

		// The wrapper is exactly the header's height, so a sticky header inside it has nowhere to
		// stick: the wrapper is what sticks (style.scss), and keeps the theme's alignment.
		if ( 1 === preg_match( '/<header\b[^>]*\bclass="bl-header\b[^"]*\bbl-header--sticky\b/', $html ) ) {
			$p->add_class( 'bl-header-part--sticky' );
		}

		if ( $p->has_class( 'alignwide' ) ) {
			$p->remove_class( 'alignwide' );
			$p->add_class( 'alignfull' );
		}

		$tag = '<div' . substr( $p->get_updated_html(), strlen( '<header' ) );

		return $tag . substr( $html, strlen( $open[0] ), $end - strlen( $open[0] ) ) . '</div>' . substr( $html, $end + strlen( '</header>' ) );
	}

	/**
	 * Text left empty prints nothing. An author's empty Heading, Text, Menu link, Button or menu item
	 * in a header shows a placeholder in the editor; on the page it would be an empty element, a
	 * link with no name or a stray gap, so it goes. Run once, on the whole rendered header.
	 */
	public static function withoutEmpty( string $html ): string {
		$patterns = [
			// A heading or text block with nothing in it.
			'#<(h[1-6]|p|span|div)\b[^>]*\bclass="bl-(?:heading|text)\b[^"]*"[^>]*>\s*</\1>#',
			// A Menu link with no label (and so nothing else worth a link).
			'#<a\b[^>]*\bclass="bl-menu-link\b[^"]*"[^>]*>(?:<span class="bl-menu-link__icon">.*?</span>)?<span class="bl-menu-link__text"><span class="bl-menu-link__label">\s*</span>(?:<span class="bl-menu-link__desc">[^<]*</span>)?</span>(?:<span class="bl-menu-link__badge">[^<]*</span>)?</a>#s',
			// A Button with no label and no icon.
			'#<(a|button)\b[^>]*\bclass="bl-button\b[^"]*"[^>]*>\s*(?:<span class="bl-button__label">\s*</span>)?\s*</\1>#',
			// A menu item with no label and no mega menu.
			'#<li\b[^>]*\bclass="bl-nav-item\b(?![^"]*has-panel)[^"]*"[^>]*><a class="bl-nav-item__link"[^>]*>\s*</a></li>#',
		];

		$out = preg_replace( $patterns, '', $html );

		return is_string( $out ) ? $out : $html;
	}

	/** A shrinking, see-through or hiding header learns when, and which way, the page has scrolled. */
	public static function header( string $html ): string {
		$p = new WP_HTML_Tag_Processor( $html );

		if ( ! $p->next_tag( 'HEADER' ) ) {
			return $html;
		}

		$hide = $p->has_class( 'bl-header--hide' );

		if ( ! $hide && ! $p->has_class( 'bl-header--shrink' ) && ! $p->has_class( 'bl-header--over' ) ) {
			return $html;
		}

		$p->set_attribute( 'data-wp-interactive', 'blicks/sticky-shrink' );
		$p->set_attribute( 'data-wp-init', 'callbacks.init' );
		$p->set_attribute( 'data-wp-on-window--scroll', 'callbacks.scroll' );

		if ( $hide ) {
			$p->set_attribute( 'data-bl-hide', '' );
			$p->set_attribute( 'data-wp-on--focusin', 'callbacks.focus' );
		}

		return $p->get_updated_html();
	}

	/**
	 * The menu: a button that opens the drawer, the list, which moves into the drawer while it is
	 * open, and the drawer.
	 *
	 * @param array<string, mixed> $attrs
	 */
	public static function nav( string $html, array $attrs ): string {
		$html = self::withoutEmpty( $html );
		$start = strpos( $html, '<ul class="bl-nav__list"' );
		$end = strrpos( $html, '</ul>' );

		if ( false === $start || false === $end || $end < $start ) {
			return $html;
		}

		$end += strlen( '</ul>' );

		// A menu with no items (every one left empty) is no menu: no button, no drawer, no landmark.
		if ( ! str_contains( substr( $html, $start, $end - $start ), '<li' ) ) {
			return '';
		}

		$uid = self::uid( $attrs, $html );
		$id = 'dialog-nav-' . $uid;
		$menu = self::text( $attrs['menuLabel'] ?? '', __( 'Menu', 'blicks-pro' ) );
		$close = self::text( $attrs['closeLabel'] ?? '', __( 'Close', 'blicks-pro' ) );

		// The Dialog block's saved markup (its golden), in its drawer kind, holding only its close
		// button until the list moves in.
		$dialog = '<dialog class="bl-dialog bl-dialog--drawer bl-dialog--from-end is-modal bl-nav__drawer" id="' . esc_attr( $id ) . '" closedby="any" aria-label="' . esc_attr( $menu ) . '">'
			. '<button type="button" class="bl-dialog__close" commandfor="' . esc_attr( $id ) . '" command="close" aria-label="' . esc_attr( $close ) . '"></button>'
			. '</dialog>';

		$list = new WP_HTML_Tag_Processor( substr( $html, $start, $end - $start ) );
		$list->next_tag( 'UL' );
		$list->set_attribute( 'data-wp-interactive', 'blicks/portal' );
		$list->set_attribute( 'data-wp-init', 'callbacks.init' );
		$list->set_attribute( 'data-bl-portal', $id );

		$rendered = render_block(
			[
				'blockName' => 'blicks/dialog',
				'attrs' => [
					'anchor' => 'nav-' . $uid,
					'kind' => 'drawer',
					'label' => $menu,
					'closeLabel' => $close,
				],
				'innerBlocks' => [],
				'innerHTML' => $dialog,
				'innerContent' => [ $dialog ],
			]
		);

		$toggle = '<button type="button" class="bl-nav__toggle" commandfor="' . esc_attr( $id ) . '" command="show-modal" aria-haspopup="dialog" aria-label="' . esc_attr( $menu ) . '"><span class="bl-nav__bars" aria-hidden="true"></span></button>';

		return substr( $html, 0, $start ) . $toggle . $list->get_updated_html() . $rendered . substr( $html, $end );
	}

	/**
	 * A menu item with a mega menu: the disclosure, wired.
	 *
	 * @param array<string, mixed> $block
	 */
	public static function navItem( string $html, array $block ): string {
		$p = new WP_HTML_Tag_Processor( $html );

		if ( ! $p->next_tag( 'LI' ) || ! $p->has_class( 'has-panel' ) ) {
			return $html;
		}

		$p->set_bookmark( 'item' );
		$attrs = self::attrs( $block );
		$panel = 'bl-panel-' . self::uid( $attrs, $html );
		$toggle = false;
		$found = false;

		while ( $p->next_tag() ) {
			if ( ! $toggle && 'BUTTON' === $p->get_tag() && $p->has_class( 'bl-nav-item__toggle' ) ) {
				$p->set_attribute( 'aria-controls', $panel );
				$p->set_attribute( 'data-wp-on--click', 'actions.toggle' );
				$toggle = true;
			} elseif ( $toggle && 'DIV' === $p->get_tag() && $p->has_class( 'bl-mega-panel' ) ) {
				$p->set_attribute( 'id', $panel );
				$found = true;
				break;
			}
		}

		if ( ! $found ) {
			return $html;
		}

		$settings = self::attrs( self::panelBlock( $block ) );
		$p->seek( 'item' );
		$p->set_attribute( 'data-wp-interactive', 'blicks/disclosure' );
		$p->set_attribute( 'data-wp-on--keydown', 'actions.key' );
		$p->set_attribute( 'data-wp-on-document--keydown', 'actions.escape' );
		$p->set_attribute( 'data-wp-on--focusout', 'actions.focusout' );
		$p->set_attribute( 'data-wp-on-document--click', 'actions.outside' );

		if ( 'click' !== ( $settings['openOn'] ?? 'hover' ) ) {
			$p->set_attribute( 'data-wp-on--pointerenter', 'blicks/hover-intent::actions.enter' );
			$p->set_attribute( 'data-wp-on--pointerleave', 'blicks/hover-intent::actions.leave' );
			$p->set_attribute( 'data-wp-on--bl-intent', 'actions.intent' );
			$p->set_attribute( 'data-bl-delay', (string) max( 0, min( 2000, (int) ( $settings['delay'] ?? 150 ) ) ) );
		}

		if ( true === ( $settings['closeOnScroll'] ?? false ) ) {
			$p->set_attribute( 'data-wp-on-window--scroll', 'actions.scroll' );
			$p->set_attribute( 'data-bl-close-on-scroll', '' );
		}

		$html = $p->get_updated_html();

		// The drawer's next screen: Back, and the item's name, at the top of the panel.
		$at = strpos( $html, ' id="' . $panel . '"' );
		$open = false === $at ? false : strpos( $html, '>', $at );

		if ( false === $open ) {
			return $html;
		}

		$head = '<button type="button" class="bl-mega-panel__back" data-bl-focus data-wp-on--click="actions.close">' . esc_html__( 'Back', 'blicks-pro' ) . '</button>'
			. '<p class="bl-mega-panel__title" aria-hidden="true">' . esc_html( self::text( $attrs['label'] ?? '', '' ) ) . '</p>';

		return substr( $html, 0, $open + 1 ) . $head . substr( $html, $open + 1 );
	}

	/**
	 * @param array<string, mixed> $block
	 * @return array<string, mixed>
	 */
	private static function attrs( array $block ): array {
		return is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
	}

	/**
	 * The item's mega menu block, or an empty one.
	 *
	 * @param array<string, mixed> $block
	 * @return array<string, mixed>
	 */
	private static function panelBlock( array $block ): array {
		foreach ( is_array( $block['innerBlocks'] ?? null ) ? $block['innerBlocks'] : [] as $inner ) {
			if ( is_array( $inner ) && 'blicks/mega-panel' === ( $inner['blockName'] ?? '' ) ) {
				return $inner;
			}
		}

		return [];
	}

	/**
	 * The block's own id, for ids it writes. A block saved without one gets one from its markup,
	 * the same on every render of the same markup.
	 *
	 * @param array<string, mixed> $attrs
	 */
	private static function uid( array $attrs, string $html ): string {
		$uid = preg_replace( '/[^a-z0-9]/', '', strtolower( (string) ( $attrs['uniqueId'] ?? '' ) ) );

		return '' !== $uid ? $uid : substr( md5( $html ), 0, 8 );
	}

	/** Plain text from a stored label: tags dropped, else the fallback. */
	private static function text( mixed $value, string $fallback ): string {
		$text = trim( wp_strip_all_tags( is_string( $value ) ? $value : '' ) );

		return '' !== $text ? $text : $fallback;
	}
}
