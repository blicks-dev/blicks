<?php
/**
 * Wires the Dialog block's page-side work.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Blocks\Dialogs;
use Blicks\Core\ServiceProvider;
use Blicks\Core\Attributes\Action;
use Blicks\Core\Attributes\Filter;

/**
 * Dialogs on the page:
 *
 *  - names each rendered dialog, aims its Close buttons at it and gives it the `dialog`
 *    behaviour's directives ({@see Dialogs::dialog()}), which load the behaviour on this page;
 *  - tells a companion plugin, in the footer, which dialogs the page opens but does not hold
 *    (`blicks_dialog_missing`), so it can print dialogs saved elsewhere;
 *  - keeps the attributes the dialog markup uses through kses, for accounts that cannot post
 *    unfiltered HTML on a WordPress whose list does not have them yet.
 */
final class DialogServiceProvider extends ServiceProvider {

	/**
	 * @param array<string, mixed> $block
	 */
	#[Filter( 'render_block', priority: 20, args: 2 )]
	public function render( string $block_content, array $block ): string {
		if ( 'blicks/dialog' === ( $block['blockName'] ?? '' ) ) {
			return self::markup( Dialogs::dialog( $block_content ), $block );
		}

		Dialogs::openers( $block_content );

		return $block_content;
	}

	/**
	 * A rendered dialog, passed through `blicks_dialog_markup`. Whatever the filter returns that is
	 * not a string is ignored, so a broken callback leaves the dialog as it was.
	 *
	 * @param array<string, mixed> $block
	 */
	public static function markup( string $html, array $block ): string {
		$id = 1 === preg_match( '/<dialog\b[^>]*\sid="(dialog-[a-z0-9-]+)"/', $html, $match ) ? $match[1] : '';

		/**
		 * Filters a rendered Dialog block's HTML, after its page-side attributes are written. For a
		 * companion to add its own attributes to the `<dialog>`, such as the triggers of a dialog
		 * it opens by itself.
		 *
		 * @param string               $html  The `<dialog>` and its contents.
		 * @param string               $id    Its id, e.g. `dialog-newsletter`, or '' when it has none.
		 * @param array<string, mixed> $block The parsed block.
		 */
		$filtered = apply_filters( 'blicks_dialog_markup', $html, $id, $block );

		return is_string( $filtered ) ? $filtered : $html;
	}

	/**
	 * Before the footer scripts print, so a companion's dialogs can still enqueue what they need;
	 * and before the page's scoped CSS is gathered (`StyleServiceProvider::printInlineCss()`, at 5),
	 * so the styles of the dialogs a companion prints here are in it.
	 */
	#[Action( 'wp_footer', priority: 4 )]
	public function missing(): void {
		$missing = Dialogs::missing();

		if ( [] !== $missing ) {
			/**
			 * Fires when the page opens dialogs it does not render: a Button or a link names
			 * `dialog-<address>` and no Dialog block on the page has that id.
			 *
			 * @param list<string> $missing The dialog ids, e.g. `dialog-newsletter`.
			 */
			do_action( 'blicks_dialog_missing', $missing );
		}
	}

	/**
	 * `<dialog closedby>` and `<button commandfor command>`, for posts by authors and editors.
	 *
	 * @param array<string, mixed> $tags
	 * @return array<string, mixed>
	 */
	#[Filter( 'wp_kses_allowed_html', priority: 10, args: 2 )]
	public function allowedHtml( array $tags, mixed $context ): array {
		if ( 'post' !== $context ) {
			return $tags;
		}

		$tags['dialog'] = array_merge( is_array( $tags['dialog'] ?? null ) ? $tags['dialog'] : [], [ 'closedby' => true ] );
		$tags['button'] = array_merge(
			is_array( $tags['button'] ?? null ) ? $tags['button'] : [],
			[
				'command' => true,
				'commandfor' => true,
				'autofocus' => true,
			]
		);

		return $tags;
	}
}
