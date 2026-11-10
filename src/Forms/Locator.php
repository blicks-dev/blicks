<?php
/**
 * Finds a saved Form.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Forms;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Post;

/**
 * A send names a Form by its `uniqueId` and the post it was sent from. The server reads the form's
 * fields, rules and actions from where it is **saved**, never from the request, looking in order:
 *
 * 1. the given post, and the synced patterns (`core/block`) it references, one level deep;
 * 2. the `_blicks_form` post-meta index, written on every save ({@see self::index()}), for a form
 *    living elsewhere (a synced pattern used in a widget, a reusable section);
 * 3. block templates and template parts (`get_block_templates()`), for a form in a footer.
 *
 * Only a source the public can read counts: a published post (a private one only for a user who
 * may read it, a password-protected one only once the password is given), a synced pattern, or a
 * template. A draft's form cannot be sent to.
 *
 * Results are kept in the object cache for 10 minutes; every save bumps a generation counter that
 * is part of the key, so a change is never served stale.
 */
final class Locator {

	/** The post meta listing the Form ids a post holds, one row each. */
	public const META = '_blicks_form';

	private const GROUP = 'blicks_forms';

	private const TTL = 10 * MINUTE_IN_SECONDS;

	/** A miss is remembered for less: someone may be about to publish the form. */
	private const MISS_TTL = MINUTE_IN_SECONDS;

	/** Post types whose saves never hold a form worth indexing. */
	/** Set while searching when a password-protected source was looked at. */
	private static bool $volatile = false;

	private const SKIP_TYPES = [ 'revision', 'attachment', 'nav_menu_item', 'customize_changeset', 'oembed_cache', 'user_request', 'wp_global_styles', Entries::POST_TYPE ];

	/** Post types that are not viewable themselves but whose content is shown on viewable pages. */
	private const PART_TYPES = [ 'wp_block', 'wp_template', 'wp_template_part' ];

	/**
	 * The saved form, or null when no readable source holds it.
	 *
	 * @return array{block: array<string, mixed>, settings: array<string, mixed>, fields: list<array<string, mixed>>, post: int, title: string}|null
	 */
	public static function find( string $formId, int $postId ): ?array {
		$formId = Schema::uid( $formId );

		if ( '' === $formId ) {
			return null;
		}

		// Readability depends on who asks (a private post), so a signed-in user has keys of their own.
		$key = 'loc_' . self::generation() . '_' . $formId . '_' . max( 0, $postId ) . '_' . get_current_user_id();
		$found = false;
		$cached = wp_cache_get( $key, self::GROUP, false, $found );

		if ( $found ) {
			return is_array( $cached ) ? $cached : null;
		}

		self::$volatile = false;
		$result = self::search( $formId, $postId );

		// A password-protected source depends on the visitor's cookie: never remembered.
		if ( ! self::$volatile ) {
			wp_cache_set( $key, $result ?? 0, self::GROUP, null === $result ? self::MISS_TTL : self::TTL );
		}

		return $result;
	}

	/**
	 * On `save_post`: record which forms a post holds, as one `_blicks_form` row per form.
	 *
	 * Written for every status (a draft is indexed too, and refused at read time), so publishing
	 * needs no second pass. Revisions, autosaves and entries are skipped.
	 */
	public static function index( int $postId, mixed $post = null ): void {
		if ( $postId <= 0 || wp_is_post_revision( $postId ) || wp_is_post_autosave( $postId ) ) {
			return;
		}

		$post = $post instanceof WP_Post ? $post : get_post( $postId );

		if ( ! $post instanceof WP_Post || in_array( $post->post_type, self::SKIP_TYPES, true ) ) {
			return;
		}

		$ids = str_contains( $post->post_content, '<!-- wp:' . Schema::FORM_BLOCK ) ? self::formIds( parse_blocks( $post->post_content ) ) : [];
		$before = array_map( 'strval', (array) get_post_meta( $postId, self::META, false ) );

		if ( $before !== $ids ) {
			delete_post_meta( $postId, self::META );

			foreach ( $ids as $id ) {
				add_post_meta( $postId, self::META, $id );
			}
		}

		self::flush();
	}

	/** Forget every cached lookup. */
	public static function flush(): void {
		wp_cache_set( 'generation', self::generation() + 1, self::GROUP );
	}

	/**
	 * The generation every key carries. Started from the clock, so a counter evicted from a
	 * persistent cache restarts above every key written before it.
	 */
	private static function generation(): int {
		$generation = wp_cache_get( 'generation', self::GROUP );

		if ( ! is_int( $generation ) ) {
			$generation = (int) ( microtime( true ) * 1000 );
			wp_cache_set( 'generation', $generation, self::GROUP );
		}

		return $generation;
	}

	/** @return array{block: array<string, mixed>, settings: array<string, mixed>, fields: list<array<string, mixed>>, post: int, title: string}|null */
	private static function search( string $formId, int $postId ): ?array {
		$tried = [];

		// 1. The post it was sent from, and the synced patterns that post uses.
		$post = $postId > 0 ? get_post( $postId ) : null;

		if ( $post instanceof WP_Post && self::readable( $post ) ) {
			$tried[ $post->ID ] = true;
			$blocks = parse_blocks( $post->post_content );
			$block = Schema::find( $blocks, $formId );

			if ( null !== $block ) {
				return self::result( $block, $post->ID, $post->post_title );
			}

			foreach ( self::refs( $blocks ) as $ref ) {
				$tried[ $ref ] = true;
				$found = self::inPost( $ref, $formId );

				if ( null !== $found ) {
					return $found;
				}
			}
		}

		// 2. The index: any other post that says it holds this form.
		$ids = get_posts(
			[
				'post_type' => array_values( array_diff( get_post_types(), self::SKIP_TYPES ) ),
				'post_status' => [ 'publish', 'private' ],
				'meta_key' => self::META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- indexed key, one lookup per uncached send.
				'meta_value' => $formId, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- as above.
				'fields' => 'ids',
				'posts_per_page' => 10,
				'orderby' => 'ID',
				'order' => 'ASC',
				'no_found_rows' => true,
			]
		);

		foreach ( $ids as $id ) {
			if ( isset( $tried[ (int) $id ] ) ) {
				continue;
			}

			$found = self::inPost( (int) $id, $formId );

			if ( null !== $found ) {
				return $found;
			}
		}

		// 3. Templates and template parts, from the theme or edited in the Site Editor.
		foreach ( [ 'wp_template_part', 'wp_template' ] as $type ) {
			foreach ( get_block_templates( [], $type ) as $template ) {
				if ( 'publish' !== $template->status || ! str_contains( (string) $template->content, $formId ) ) {
					continue;
				}

				$block = Schema::find( parse_blocks( (string) $template->content ), $formId );

				if ( null !== $block ) {
					return self::result( $block, (int) ( $template->wp_id ?? 0 ), (string) $template->title );
				}
			}
		}

		return null;
	}

	/** @return array{block: array<string, mixed>, settings: array<string, mixed>, fields: list<array<string, mixed>>, post: int, title: string}|null */
	private static function inPost( int $id, string $formId ): ?array {
		$post = get_post( $id );

		if ( ! $post instanceof WP_Post || ! self::readable( $post ) ) {
			return null;
		}

		$block = Schema::find( parse_blocks( $post->post_content ), $formId );

		return null !== $block ? self::result( $block, $post->ID, $post->post_title ) : null;
	}

	/**
	 * May a visitor send to a form saved here?
	 */
	private static function readable( WP_Post $post ): bool {
		if ( in_array( $post->post_type, self::SKIP_TYPES, true ) ) {
			return false;
		}

		if ( ! in_array( $post->post_type, self::PART_TYPES, true ) && ! is_post_type_viewable( $post->post_type ) ) {
			return false;
		}

		if ( 'private' === $post->post_status ) {
			return current_user_can( 'read_post', $post->ID );
		}

		if ( '' !== $post->post_password ) {
			self::$volatile = true;
		}

		return 'publish' === $post->post_status && ! post_password_required( $post );
	}

	/**
	 * The synced patterns a block list references.
	 *
	 * @param array<int, mixed> $blocks
	 * @return list<int>
	 */
	private static function refs( array $blocks ): array {
		$refs = [];

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			if ( 'core/block' === ( $block['blockName'] ?? '' ) && is_numeric( $block['attrs']['ref'] ?? null ) ) {
				$refs[] = (int) $block['attrs']['ref'];
			}

			if ( is_array( $block['innerBlocks'] ?? null ) ) {
				$refs = array_merge( $refs, self::refs( $block['innerBlocks'] ) );
			}
		}

		return array_values( array_unique( array_filter( $refs, static fn ( int $ref ): bool => $ref > 0 ) ) );
	}

	/**
	 * Every Form id in a block list, at any depth.
	 *
	 * @param array<int, mixed> $blocks
	 * @return list<string>
	 */
	private static function formIds( array $blocks ): array {
		$ids = [];

		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}

			if ( Schema::FORM_BLOCK === ( $block['blockName'] ?? '' ) ) {
				$id = Schema::uid( $block['attrs']['uniqueId'] ?? '' );

				if ( '' !== $id ) {
					$ids[] = $id;
				}
			}

			if ( is_array( $block['innerBlocks'] ?? null ) ) {
				$ids = array_merge( $ids, self::formIds( $block['innerBlocks'] ) );
			}
		}

		return array_values( array_unique( $ids ) );
	}

	/**
	 * @param array<string, mixed> $block
	 * @return array{block: array<string, mixed>, settings: array<string, mixed>, fields: list<array<string, mixed>>, post: int, title: string}
	 */
	private static function result( array $block, int $post, string $title ): array {
		$settings = Schema::settings( is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [] );
		return [
			'block' => $block,
			'settings' => $settings,
			'fields' => Schema::fields( $block ),
			'post' => $post,
			// The form's own name, when it has one, names its entries and emails; else where it lives.
			'title' => '' !== $settings['name'] ? $settings['name'] : sanitize_text_field( $title ),
		];
	}
}
