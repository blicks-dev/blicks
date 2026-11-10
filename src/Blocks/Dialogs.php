<?php
/**
 * What a Dialog needs from the page it is rendered on.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Blocks;

use WP_HTML_Tag_Processor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A `blicks/dialog` is static: its saved markup is a `<dialog>` with its options as classes, and a
 * Button that opens it saves `commandfor` and `command`. What depends on the page is written here,
 * at render, so it can change without touching saved posts:
 *
 *  - the dialog's accessible name, from its first heading, when it was not given one;
 *  - a Close dialog Button inside it, pointed at it (a Button cannot know its dialog's id when it
 *    is saved, e.g. in a pattern used on many pages);
 *  - which dialogs the page names and which it actually renders, so a companion plugin can print
 *    the ones that live elsewhere (`blicks_dialog_missing`);
 *  - the `dialog` behaviour's directives (resources/behaviours/dialog.ts), which make the dialog an
 *    Interactivity region and so load the behaviour on this page ({@see \Blicks\Behaviours\Behaviours});
 *  - on a dialog that does not block the page, `popover="manual"`, so the behaviour can show it in
 *    the top layer clear of any transformed ancestor, and `closedby="closerequest"`, so a click on
 *    the page it leaves usable does not close it.
 */
final class Dialogs {

	/** The `dialog` behaviour's directives, on the `<dialog>`. */
	private const DIRECTIVES = [
		'data-wp-interactive' => 'blicks/dialog',
		'data-wp-init' => 'callbacks.init',
		'data-wp-on-window--hashchange' => 'callbacks.address',
		'data-wp-on-window--popstate' => 'callbacks.moved',
		'data-wp-on-document--click' => 'actions.click',
		'data-wp-on-document--keydown' => 'actions.key',
		'data-wp-on--pointerdown' => 'actions.press',
		'data-wp-on--command' => 'actions.command',
		'data-wp-on--cancel' => 'actions.cancel',
		'data-wp-on--close' => 'actions.closed',
	];

	/** @var array<string, true> Dialog ids rendered on this page. */
	private static array $rendered = [];

	/** @var array<string, true> Dialog ids a Button or link on this page opens. */
	private static array $named = [];

	/** Forget the page: for tests, and for anything that renders more than one page per request. */
	public static function reset(): void {
		self::$rendered = [];
		self::$named = [];
	}

	/**
	 * A rendered Dialog block: name it, aim its Close buttons at it, and note that it is here.
	 */
	public static function dialog( string $html ): string {
		$p = new WP_HTML_Tag_Processor( $html );

		if ( ! $p->next_tag( 'DIALOG' ) ) {
			return $html;
		}

		$id = (string) $p->get_attribute( 'id' );
		$p->set_bookmark( 'dialog' );
		$named = null !== $p->get_attribute( 'aria-label' ) || null !== $p->get_attribute( 'aria-labelledby' );

		if ( '' !== $id ) {
			self::$rendered[ $id ] = true;
		}

		foreach ( self::DIRECTIVES as $name => $value ) {
			$p->set_attribute( $name, $value );
		}

		// Not blocking the page: shown as a popover too, so it is in the top layer and sits in the
		// corner of the screen even inside a transformed or clipped ancestor (dialog.ts). And the page
		// stays usable, so using it does not close the dialog: `closedby="any"` would, on any click.
		if ( ! $p->has_class( 'is-modal' ) ) {
			if ( null === $p->get_attribute( 'popover' ) ) {
				$p->set_attribute( 'popover', 'manual' );
			}
			if ( 'any' === $p->get_attribute( 'closedby' ) ) {
				$p->set_attribute( 'closedby', 'closerequest' );
			}
		}

		$headingId = '';

		while ( $p->next_tag() ) {
			$tag = $p->get_tag();

			// A nested dialog is its own: leave its heading and its buttons to it.
			if ( 'DIALOG' === $tag ) {
				break;
			}

			if ( 'BUTTON' === $tag && 'close' === $p->get_attribute( 'command' ) && '' !== $id && ! $p->get_attribute( 'commandfor' ) ) {
				$p->set_attribute( 'commandfor', $id );
			}

			if ( ! $named && '' === $headingId && 1 === preg_match( '/^H[1-6]$/', (string) $tag ) ) {
				$headingId = (string) $p->get_attribute( 'id' );

				if ( '' === $headingId && '' !== $id ) {
					$headingId = $id . '-title';
					$p->set_attribute( 'id', $headingId );
				}
			}
		}

		if ( '' !== $headingId && $p->seek( 'dialog' ) ) {
			$p->set_attribute( 'aria-labelledby', $headingId );
		}

		return $p->get_updated_html();
	}

	/**
	 * Any rendered block: note the dialogs it opens. True when it opens one, so the caller knows
	 * the page needs the dialog script.
	 */
	public static function openers( string $html ): bool {
		if ( ! str_contains( $html, 'commandfor' ) && ! str_contains( $html, '#dialog-' ) ) {
			return false;
		}

		$p = new WP_HTML_Tag_Processor( $html );
		$found = false;

		while ( $p->next_tag() ) {
			$target = '';

			if ( 'BUTTON' === $p->get_tag() && 'show-modal' === $p->get_attribute( 'command' ) ) {
				$target = (string) $p->get_attribute( 'commandfor' );
			} elseif ( 'A' === $p->get_tag() ) {
				$href = (string) $p->get_attribute( 'href' );
				$target = str_starts_with( $href, '#dialog-' ) ? substr( $href, 1 ) : '';
			}

			if ( 1 === preg_match( '/^dialog-[a-z0-9-]+$/', $target ) ) {
				self::$named[ $target ] = true;
				$found = true;
			}
		}

		return $found;
	}

	/** @return list<string> Dialogs the page opens but does not render. */
	public static function missing(): array {
		return array_values( array_diff( array_keys( self::$named ), array_keys( self::$rendered ) ) );
	}
}
