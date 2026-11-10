<?php
/**
 * The saved dialogs: where they are kept and how they are found.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

use WP_Post;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A saved dialog is a `blicks_dialog` post whose content is one `blicks/dialog` block. A Button or
 * a link names it by its `<dialog>` id (`dialog-newsletter`), the same way it names a dialog on the
 * page, so two private meta values are kept in step with the content on every save: that id, and
 * whether a trigger opens it by itself. Both are what the front end looks dialogs up by, so neither
 * page view parses a dialog's blocks.
 */
final class Library {

	public const TYPE = 'blicks_dialog';

	/** The `<dialog>` id the content renders, e.g. `dialog-newsletter`. */
	public const DOM_ID = '_blicks_dialog_id';

	/** '1' when any automatic trigger is on. */
	public const AUTO = '_blicks_dialog_auto';

	/** How many automatic dialogs one page considers at most. */
	public const AUTO_LIMIT = 10;

	/** @var array<string, WP_Post|null> */
	private static array $byId = [];

	/** @var list<WP_Post>|null */
	private static ?array $automatic = null;

	/** Forget what was looked up: for tests, and after a dialog is saved. */
	public static function reset(): void {
		self::$byId = [];
		self::$automatic = null;
	}

	/**
	 * The `<dialog>` id a dialog's content renders: `dialog-` and its anchor, as the free block
	 * writes it (`resources/blocks/dialog/model.ts`, `dialogId()`), or '' when the content holds no
	 * dialog.
	 */
	public static function domIdOf( string $content ): string {
		foreach ( parse_blocks( $content ) as $block ) {
			if ( 'blicks/dialog' !== ( $block['blockName'] ?? null ) ) {
				continue;
			}

			$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
			$slug = self::slug( $attrs['anchor'] ?? '' );
			$slug = '' !== $slug ? $slug : self::slug( $attrs['uniqueId'] ?? '' );

			return 'dialog-' . ( '' !== $slug ? $slug : 'dialog' );
		}

		return '';
	}

	/** `Size guide!` → `size-guide`, as `slugify()` in the block's model does it. */
	public static function slug( mixed $value ): string {
		$text = strtolower( remove_accents( is_scalar( $value ) ? (string) $value : '' ) );
		$text = trim( (string) preg_replace( '/[^a-z0-9]+/', '-', $text ), '-' );

		return trim( substr( $text, 0, 48 ), '-' );
	}

	/** Keep the lookup meta in step with what was just saved. */
	public static function sync( int $postId ): void {
		$post = get_post( $postId );

		if ( ! $post || self::TYPE !== $post->post_type ) {
			return;
		}

		update_post_meta( $postId, self::DOM_ID, self::domIdOf( (string) $post->post_content ) );
		update_post_meta( $postId, self::AUTO, Settings::automatic( get_post_meta( $postId, Settings::TRIGGERS, true ) ) ? '1' : '0' );
		self::reset();
	}

	/** The published dialog a Button or link names by its `<dialog>` id, or null. */
	public static function byDomId( string $domId ): ?WP_Post {
		if ( 1 !== preg_match( '/^dialog-[a-z0-9-]+$/', $domId ) ) {
			return null;
		}

		if ( ! array_key_exists( $domId, self::$byId ) ) {
			$found = get_posts(
				[
					'post_type' => self::TYPE,
					'post_status' => 'publish',
					'numberposts' => 1,
					'orderby' => 'ID',
					'order' => 'ASC',
					'no_found_rows' => true,
					// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- one indexed key, cached per request.
					'meta_query' => [
						[
							'key' => self::DOM_ID,
							'value' => $domId,
						],
					],
				]
			);

			self::$byId[ $domId ] = $found[0] ?? null;
		}

		return self::$byId[ $domId ];
	}

	/** @return list<WP_Post> Published dialogs that open by themselves. */
	public static function automatic(): array {
		if ( null === self::$automatic ) {
			self::$automatic = array_values(
				get_posts(
					[
						'post_type' => self::TYPE,
						'post_status' => 'publish',
						'numberposts' => self::AUTO_LIMIT,
						'orderby' => 'menu_order date',
						'order' => 'ASC',
						'no_found_rows' => true,
						// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- one indexed key, cached per request.
						'meta_query' => [
							[
								'key' => self::AUTO,
								'value' => '1',
							],
						],
					]
				)
			);
		}

		return self::$automatic;
	}

	/**
	 * Every saved dialog, for the Button's picker: published ones and drafts, so a Button can be
	 * aimed at a dialog that is not switched on yet.
	 *
	 * @return list<array{id: string, title: string, modal: bool, source: string, post: int, status: string}>
	 */
	public static function targets(): array {
		$out = [];

		foreach (
			get_posts(
				[
					'post_type' => self::TYPE,
					'post_status' => [ 'publish', 'draft' ],
					// phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_numberposts -- every dialog belongs in the picker; ids and titles only.
					'numberposts' => 200,
					'orderby' => 'title',
					'order' => 'ASC',
					'no_found_rows' => true,
				]
			) as $post
		) {
			$domId = (string) get_post_meta( $post->ID, self::DOM_ID, true );

			if ( '' === $domId ) {
				continue;
			}

			$out[] = [
				'id' => $domId,
				'title' => '' !== $post->post_title ? $post->post_title : $domId,
				'modal' => ! str_contains( (string) $post->post_content, '"modal":false' ),
				'source' => 'saved',
				'post' => (int) $post->ID,
				'status' => (string) $post->post_status,
			];
		}

		return $out;
	}
}
