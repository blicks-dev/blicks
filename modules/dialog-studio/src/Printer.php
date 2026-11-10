<?php
/**
 * Prints saved dialogs into the pages that need them.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

use WP_HTML_Tag_Processor;
use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A saved dialog lives in no page's content. It is printed in the footer, rendered with
 * `do_blocks()` exactly as a Dialog block in the content is, when the page asks for it: a Button or
 * a link names it (`blicks_dialog_missing`), or it opens by itself and its server rules
 * ({@see ServerRules}) let it onto this page. An automatic one carries its triggers and visitor
 * rules in `data-bl-auto`, which `resources/view/auto.ts` reads.
 *
 * The `dialog` behaviour (`@blicks/dialog`) must be on the page for it to open. A block theme prints
 * its import map in the head, after the template has rendered and before the footer, so a module
 * first asked for in the footer would be missing from the map. So the behaviour is asked for as
 * soon as an opener of a saved dialog renders, which in a block theme is before the head.
 */
final class Printer {

	/** The behaviour's script module, as the free plugin registers it. */
	public const BEHAVIOUR = '@blicks/dialog';

	/** The automatic triggers and visitor rules: this module's own script module. */
	public const AUTO = '@blicks-pro/dialog-auto';

	/** @var list<WP_Post>|null Automatic dialogs this page may show, once decided. */
	private ?array $automatic = null;

	/** @var array<int, true> Saved dialogs printed on this page. */
	private array $printed = [];

	/** The dialog being printed, while `do_blocks()` renders it. */
	private ?WP_Post $current = null;

	private static ?self $shared = null;

	/** The one printer the module's hooks use. */
	public static function shared(): self {
		return self::$shared ??= new self();
	}

	/** Forget the page: for tests. */
	public function reset(): void {
		$this->printed = [];
		$this->current = null;
		$this->automatic = null;
	}

	/**
	 * The published automatic dialogs whose server rules let them onto this page. Decided once per
	 * page, from the main query, so the head and the footer agree.
	 *
	 * @return list<WP_Post>
	 */
	public function automatic(): array {
		if ( null === $this->automatic ) {
			$page = ServerRules::page();
			$this->automatic = array_values(
				array_filter(
					Library::automatic(),
					static fn ( WP_Post $post ): bool => ServerRules::passes( Settings::rules( get_post_meta( $post->ID, Settings::RULES, true ) ), $page )
				)
			);
		}

		return $this->automatic;
	}

	/**
	 * `wp_enqueue_scripts`: on a page that will print an automatic dialog, load the behaviour and
	 * the triggers now, in time for a block theme's import map.
	 */
	public function enqueue(): void {
		if ( [] !== $this->automatic() ) {
			wp_enqueue_script_module( self::BEHAVIOUR );
			wp_enqueue_script_module( self::AUTO );
		}
	}

	/** `wp_footer`, before the scoped CSS is gathered: print the automatic dialogs. */
	public function footer(): void {
		foreach ( $this->automatic() as $post ) {
			$this->print( $post );
		}
	}

	/**
	 * What the browser needs to decide about the visitor, and the triggers: `data-bl-auto`.
	 *
	 * Everything in it is the same for every visitor, so a cached page is right for all of them.
	 *
	 * @return array<string, mixed>
	 */
	public static function autoConfig( WP_Post $post ): array {
		$rules = Settings::rules( get_post_meta( $post->ID, Settings::RULES, true ) );
		[ $from, $until ] = ServerRules::window( $rules, wp_timezone() );

		return [
			'id' => (int) $post->ID,
			'triggers' => Settings::triggers( get_post_meta( $post->ID, Settings::TRIGGERS, true ) ),
			'visitors' => $rules['visitors'],
			'screens' => $rules['screens'],
			'frequency' => $rules['frequency'],
			'days' => $rules['days'],
			'stopAfterConvert' => $rules['stopAfterConvert'],
			'from' => $from,
			'until' => $until,
		];
	}

	/**
	 * `render_block`: when a rendered block opens a saved dialog, load the behaviour now.
	 *
	 * @param mixed                $content
	 * @param array<string, mixed> $block
	 * @return mixed
	 */
	public function openers( mixed $content, array $block ): mixed {
		if ( ! is_string( $content ) || 'blicks/dialog' === ( $block['blockName'] ?? null ) || ! str_contains( $content, 'dialog-' ) ) {
			return $content;
		}

		if ( preg_match_all( '/(?:commandfor="|href="#)(dialog-[a-z0-9-]+)"/', $content, $m ) ) {
			foreach ( array_unique( $m[1] ) as $domId ) {
				if ( Library::byDomId( $domId ) ) {
					wp_enqueue_script_module( self::BEHAVIOUR );
					// Not for triggers here, but for the counts and what the visitor's browser remembers.
					wp_enqueue_script_module( self::AUTO );
					break;
				}
			}
		}

		return $content;
	}

	/**
	 * `blicks_dialog_missing`: print each saved dialog the page opens but does not hold.
	 *
	 * @param mixed $ids
	 */
	public function missing( mixed $ids ): void {
		foreach ( is_array( $ids ) ? $ids : [] as $domId ) {
			$post = is_string( $domId ) ? Library::byDomId( $domId ) : null;

			if ( $post ) {
				$this->print( $post );
			}
		}
	}

	/** Render one saved dialog where the page is being written, once per page. */
	public function print( WP_Post $post ): void {
		if ( isset( $this->printed[ $post->ID ] ) ) {
			return;
		}

		$this->printed[ $post->ID ] = true;
		$this->current = $post;

		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- block markup, rendered and escaped by the blocks themselves.
		echo do_blocks( (string) $post->post_content );

		$this->current = null;
	}

	/**
	 * `blicks_dialog_markup`: mark a printed saved dialog with its post, for the counts and the
	 * automatic triggers to find it by.
	 *
	 * @param mixed $html
	 * @return mixed
	 */
	public function markup( mixed $html ): mixed {
		if ( ! is_string( $html ) || ! $this->current ) {
			return $html;
		}

		$p = new WP_HTML_Tag_Processor( $html );

		if ( ! $p->next_tag( 'DIALOG' ) ) {
			return $html;
		}

		$p->set_attribute( 'data-bl-saved', (string) $this->current->ID );

		if ( in_array( $this->current, $this->automatic ?? [], true ) ) {
			$p->set_attribute( 'data-bl-auto', (string) wp_json_encode( self::autoConfig( $this->current ) ) );
		}

		return $p->get_updated_html();
	}
}
