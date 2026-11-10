<?php
/**
 * Counts the posts whose Loops read an endpoint.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Query;

/**
 * How many posts, pages, patterns and templates have a Loop on a given endpoint, so removing one
 * can say what goes empty.
 *
 * A Loop saves its endpoint as `"endpoint":"<id>"` in the block comment, and ids are only
 * lower-case letters, digits and dashes, so a phrase search on `post_content` finds it without
 * parsing every post. The counts are kept in one transient for an hour and dropped whenever a post
 * is saved or deleted ({@see \Blicks\Providers\DataServiceProvider}), so the number on the Settings
 * screen is never older than the last edit.
 */
final class EndpointUsage {

	private const CACHE = 'blicks_ep_usage';

	private function __construct() {}

	public static function count( string $id ): int {
		$id = (string) preg_replace( '/[^a-z0-9-]/', '', $id );
		if ( '' === $id ) {
			return 0;
		}

		$cache = get_transient( self::CACHE );
		$cache = is_array( $cache ) ? $cache : [];
		if ( isset( $cache[ $id ] ) && is_int( $cache[ $id ] ) ) {
			return $cache[ $id ];
		}

		$query = new WP_Query(
			[
				's' => '"endpoint":"' . $id . '"',
				'sentence' => true,
				'search_columns' => [ 'post_content' ],
				'post_type' => self::postTypes(),
				'post_status' => [ 'publish', 'future', 'draft', 'pending', 'private' ],
				'fields' => 'ids',
				'posts_per_page' => 1,
				'ignore_sticky_posts' => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
			]
		);

		$cache[ $id ] = (int) $query->found_posts;
		set_transient( self::CACHE, $cache, HOUR_IN_SECONDS );

		return $cache[ $id ];
	}

	/** After any post changes: the next count asks the database again. */
	public static function forget(): void {
		delete_transient( self::CACHE );
	}

	/**
	 * Every type an author can put a Loop in: anything with an editor screen, plus synced patterns
	 * and block templates.
	 *
	 * @return list<string>
	 */
	private static function postTypes(): array {
		$types = array_values( array_diff( get_post_types( [ 'show_ui' => true ] ), [ 'attachment' ] ) );

		foreach ( [ 'wp_block', 'wp_template', 'wp_template_part' ] as $type ) {
			if ( post_type_exists( $type ) && ! in_array( $type, $types, true ) ) {
				$types[] = $type;
			}
		}

		return $types;
	}
}
