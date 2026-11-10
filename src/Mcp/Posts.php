<?php
/**
 * The posts an agent may list, create and change the status of.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Mcp;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Spec\PostLayout;

/**
 * Listing, creating and publishing posts on an agent's behalf.
 *
 * Every answer is narrowed to what the signed-in account could do in wp-admin — not to what the
 * agent asks for. The capability on each ability has already been checked; this class narrows
 * *results*: a list only ever holds posts the account may edit, so a contributor's agent sees the
 * contributor's drafts and nothing else, and `total` counts only those.
 */
final class Posts {

	public const MAX_PER_PAGE = 50;

	/** The statuses `set-post-status` may set. */
	public const STATUSES = [ 'draft', 'pending', 'publish', 'private' ];

	/** The statuses that make a post visible to someone other than its editors. */
	public const PUBLIC_STATUSES = [ 'publish', 'private' ];

	/** How many candidates one listing looks at before filtering by permission. */
	private const CANDIDATES = 500;

	/**
	 * Post types an agent may work on: editable in the block editor and shown in wp-admin.
	 *
	 * Attachments, navigation menus, templates, reusable blocks and global styles are excluded even
	 * where they are block-editor content: they are site structure, not pages, and rewriting one
	 * changes every page that uses it.
	 *
	 * @return list<string>
	 */
	public static function types(): array {
		$types = [];

		foreach ( get_post_types(
			[
				'show_ui' => true,
				'show_in_rest' => true,
			]
		) as $type ) {
			if ( 'attachment' === $type || str_starts_with( $type, 'wp_' ) || ! post_type_supports( $type, 'editor' ) ) {
				continue;
			}

			$types[] = $type;
		}

		/**
		 * Filters the post types Blicks MCP tools may read and write.
		 *
		 * @param list<string> $types
		 */
		$filtered = apply_filters( 'blicks_mcp_post_types', $types );

		return is_array( $filtered ) ? array_values( array_filter( $filtered, 'is_string' ) ) : $types;
	}

	public static function isAllowedType( string $type ): bool {
		return in_array( $type, self::types(), true );
	}

	/**
	 * Posts the current account may edit, newest change first.
	 *
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public static function list( array $input ): array {
		$type = is_string( $input['postType'] ?? null ) ? $input['postType'] : 'page';

		if ( ! self::isAllowedType( $type ) ) {
			return [ 'error' => sprintf( '"%s" is not a post type you can work on here. Use one of: %s.', $type, implode( ', ', self::types() ) ) ];
		}

		$object = get_post_type_object( $type );
		$perPage = min( self::MAX_PER_PAGE, max( 1, (int) ( $input['perPage'] ?? 20 ) ) );
		$page = max( 1, (int) ( $input['page'] ?? 1 ) );

		$query = [
			'post_type' => $type,
			'post_status' => [ 'publish', 'future', 'draft', 'pending', 'private' ],
			'posts_per_page' => self::CANDIDATES,
			'orderby' => 'modified',
			'order' => 'DESC',
			'no_found_rows' => true,
			'ignore_sticky_posts' => true,
			'suppress_filters' => false,
		];

		if ( is_string( $input['search'] ?? null ) && '' !== trim( $input['search'] ) ) {
			$query['s'] = trim( $input['search'] );
		}

		// An account that may edit only its own posts is asked only about its own posts, so the
		// candidate window is not spent on rows the filter below would drop anyway.
		if ( null !== $object && ! current_user_can( $object->cap->edit_others_posts ) ) {
			$query['author'] = get_current_user_id();
		}

		$editable = array_values(
			array_filter(
				get_posts( $query ),
				static fn ( \WP_Post $post ): bool => current_user_can( 'edit_post', $post->ID )
			)
		);

		$rows = array_map(
			static fn ( \WP_Post $post ): array => [
				'id' => (int) $post->ID,
				'title' => (string) $post->post_title,
				'status' => (string) $post->post_status,
				'modified' => self::modified( $post ),
				'usesBlicks' => str_contains( (string) $post->post_content, '<!-- wp:blicks/' ),
			],
			array_slice( $editable, ( $page - 1 ) * $perPage, $perPage )
		);

		return [
			'postType' => $type,
			'page' => $page,
			'perPage' => $perPage,
			// Counted after the permission filter, so it never reveals how many posts exist that
			// this account cannot see.
			'total' => count( $editable ),
			'posts' => $rows,
		];
	}

	/**
	 * A new draft, owned by the current account.
	 *
	 * @param list<mixed> $blocks
	 * @return array<string, mixed>
	 */
	public static function create( string $title, string $type, array $blocks ): array {
		if ( ! self::isAllowedType( $type ) ) {
			return [ 'error' => sprintf( '"%s" is not a post type you can create here. Use one of: %s.', $type, implode( ', ', self::types() ) ) ];
		}

		$markup = '';

		if ( [] !== $blocks ) {
			$prepared = PostLayout::prepare( $blocks );

			if ( isset( $prepared['errors'] ) ) {
				return [
					'created' => false,
					'errors' => $prepared['errors'],
				];
			}

			$markup = $prepared['markup'];
		}

		$id = wp_insert_post(
			wp_slash(
				[
					'post_type' => $type,
					// Always a draft. Making it public is a separate, explicit step.
					'post_status' => 'draft',
					'post_title' => sanitize_text_field( $title ),
					'post_content' => $markup,
					'post_author' => get_current_user_id(),
				]
			),
			true
		);

		if ( is_wp_error( $id ) ) {
			return [
				'created' => false,
				'error' => $id->get_error_message(),
			];
		}

		return [
			'created' => true,
			'id' => (int) $id,
			'status' => 'draft',
			'editUrl' => (string) get_edit_post_link( (int) $id, 'raw' ),
		];
	}

	/**
	 * Change one post's status. The permission gate has already required `publish_post` for a
	 * status in {@see self::PUBLIC_STATUSES}.
	 *
	 * @return array<string, mixed>
	 */
	public static function setStatus( int $id, string $status ): array {
		$post = get_post( $id );

		if ( null === $post || ! in_array( $status, self::STATUSES, true ) ) {
			return [ 'error' => sprintf( 'Post %d could not be changed.', $id ) ];
		}

		if ( $post->post_status === $status ) {
			return [
				'id' => $id,
				'status' => $status,
				'changed' => false,
			];
		}

		$refusal = PostLayout::refusal( $post );

		if ( null !== $refusal ) {
			return [
				'changed' => false,
				'error' => $refusal,
			];
		}

		$updated = wp_update_post(
			[
				'ID' => $id,
				'post_status' => $status,
			],
			true
		);

		if ( is_wp_error( $updated ) ) {
			return [
				'changed' => false,
				'error' => $updated->get_error_message(),
			];
		}

		$now = (string) get_post_status( $id );

		return [
			'id' => $id,
			'status' => $now,
			'changed' => true,
			'url' => 'publish' === $now ? (string) get_permalink( $id ) : '',
		];
	}

	/** When a post last changed. Drafts carry no GMT date, which `get_post_datetime()` accounts for. */
	private static function modified( \WP_Post $post ): string {
		$date = get_post_datetime( $post, 'modified' );

		return false === $date ? '' : $date->format( DATE_ATOM );
	}
}
