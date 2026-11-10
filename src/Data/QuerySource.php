<?php
/**
 * Reads a Loop's items from a WordPress query.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Post;
use WP_Query;

/**
 * A Loop's `query` settings → `WP_Query` → items.
 *
 * **Only what a visitor may see.** The query always asks for published posts of a public post type,
 * leaves out password-protected ones, and filters by public taxonomies only. Every setting is
 * mapped from an allow-list: a key the block did not offer is dropped, never passed through, so
 * post content cannot smuggle arbitrary `WP_Query` arguments (`post_status => any`, `meta_query`
 * over private fields) into a page.
 */
final class QuerySource {

	public const ORDER_BY = [ 'date', 'modified', 'title', 'menu_order', 'comment_count', 'rand' ];
	public const STICKY = [ 'include', 'ignore', 'only' ];

	/** WordPress meta comparisons for each filter operator. */
	private const META_COMPARE = [
		'is' => '=',
		'not' => '!=',
		'has' => 'LIKE',
		'gt' => '>',
		'lt' => '<',
		'set' => 'EXISTS',
		'empty' => 'NOT EXISTS',
	];

	private const DEFAULT_LIMIT = 12;

	private function __construct() {}

	/**
	 * The items for a Loop's query.
	 *
	 * @param array<string, mixed> $query  The Loop's `query` attribute.
	 * @param int                  $current The post being shown, left out when `excludeCurrent`.
	 * @return list<array<string, mixed>>
	 */
	public static function items( array $query, int $limit, int $offset, int $current ): array {
		if ( ! empty( $query['inherit'] ) && self::main() instanceof WP_Query ) {
			return self::toItems( self::main()->posts );
		}

		return self::read( $query, $limit, $offset, $current )['items'];
	}

	/**
	 * The items and, when `$count` is set, how many posts match in all (for page links). A paged
	 * Loop asks for one page (or pages 1 to N for Load more) through `$limit` and `$offset`, and
	 * may take up to {@see Pager::MAX_STACK} posts at once.
	 *
	 * @param array<string, mixed> $query
	 * @return array{items: list<array<string, mixed>>, found: int}
	 */
	public static function read( array $query, int $limit, int $offset, int $current, bool $count = false ): array {
		$args = self::args( $query, $limit, $offset, $current, $count ? Pager::MAX_STACK : ItemPipeline::MAX_ITEMS );
		if ( null === $args ) {
			return [
				'items' => [],
				'found' => 0,
			];
		}

		if ( $count ) {
			$args['no_found_rows'] = false;
		}

		$run = new WP_Query( $args );
		$items = self::toItems( $run->posts );

		return [
			'items' => $items,
			'found' => $count ? (int) $run->found_posts : count( $items ),
		];
	}

	/**
	 * A Loop that uses the page's own query, paged as the archive is: WordPress has already run
	 * page `$first`. For Load more's pages 1 to N the same query runs again from the first post,
	 * N pages long; everything else about it (type, terms, search, filters) is the archive's.
	 *
	 * @return array{items: list<array<string, mixed>>, found: int, perPage: int, pages: int}
	 */
	public static function inherited( int $first, int $span ): array {
		$main = self::main();
		if ( ! $main instanceof WP_Query ) {
			return [
				'items' => [],
				'found' => 0,
				'perPage' => Pager::DEFAULT_PER_PAGE,
				'pages' => 1,
			];
		}

		$perPage = (int) $main->get( 'posts_per_page' );
		$posts = $main->posts;

		if ( $span > 1 && $perPage > 0 ) {
			$args = $main->query_vars;
			$args['paged'] = 1;
			$args['offset'] = 0;
			$args['posts_per_page'] = min( Pager::MAX_STACK, $perPage * $span );
			$args['no_found_rows'] = true;
			$posts = ( new WP_Query( $args ) )->posts;
		}

		return [
			'items' => self::toItems( $posts ),
			'found' => (int) $main->found_posts,
			'perPage' => $perPage > 0 ? $perPage : max( 1, (int) $main->found_posts ),
			'pages' => max( 1, (int) $main->max_num_pages ),
		];
	}

	private static function main(): ?WP_Query {
		return isset( $GLOBALS['wp_query'] ) && $GLOBALS['wp_query'] instanceof WP_Query ? $GLOBALS['wp_query'] : null;
	}

	/**
	 * @param mixed $posts A query's `posts`: null when that query never ran (the main query in a
	 *                     REST request that renders content), so an inheriting Loop has no items.
	 * @return list<array<string, mixed>>
	 */
	private static function toItems( mixed $posts ): array {
		$items = [];
		foreach ( is_array( $posts ) ? $posts : [] as $post ) {
			if ( $post instanceof WP_Post && self::visible( $post ) ) {
				$items[] = PostFields::item( $post );
			}
		}

		return $items;
	}

	/**
	 * The `WP_Query` arguments for a Loop's query, or null when the post type is not one a visitor
	 * can see.
	 *
	 * @param array<string, mixed> $query
	 * @param int                  $cap   The most posts asked for: {@see ItemPipeline::MAX_ITEMS}, or more for Load more's pages 1 to N.
	 * @return array<string, mixed>|null
	 */
	public static function args( array $query, int $limit, int $offset, int $current, int $cap = ItemPipeline::MAX_ITEMS ): ?array {
		$type = is_string( $query['postType'] ?? null ) ? sanitize_key( $query['postType'] ) : 'post';
		if ( ! post_type_exists( $type ) || ! is_post_type_viewable( $type ) ) {
			return null;
		}

		$args = [
			'post_type' => $type,
			'post_status' => 'publish',
			'has_password' => false,
			'posts_per_page' => min( min( Pager::MAX_STACK, $cap ), $limit > 0 ? $limit : self::DEFAULT_LIMIT ),
			'offset' => max( 0, $offset ),
			'no_found_rows' => true,
			'ignore_sticky_posts' => true,
			'suppress_filters' => false,
		];

		$taxQuery = self::taxQuery( is_array( $query['taxonomy'] ?? null ) ? $query['taxonomy'] : [], $type );
		if ( [] !== $taxQuery ) {
			$args['tax_query'] = $taxQuery; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- the block's own filter, on a capped query.
		}

		$author = (int) ( $query['author'] ?? 0 );
		if ( $author > 0 ) {
			$args['author'] = $author;
		}

		$meta = is_array( $query['meta'] ?? null ) ? self::metaQuery( $query['meta'], $type ) : null;
		if ( null !== $meta ) {
			$args['meta_query'] = [ $meta ]; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- one clause on a public key, on a capped query.
		}

		[ $orderBy, $metaKey ] = self::orderBy( is_string( $query['orderBy'] ?? null ) ? $query['orderBy'] : 'date', $type );
		$args['orderby'] = $orderBy;
		if ( '' !== $metaKey ) {
			$args['meta_key'] = $metaKey; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- ordering by one public key.
		}
		if ( 'rand' !== $orderBy ) {
			$args['order'] = 'asc' === strtolower( (string) ( $query['order'] ?? 'desc' ) ) ? 'ASC' : 'DESC';
		}

		if ( 'post' === $type ) {
			$sticky = in_array( $query['sticky'] ?? 'include', self::STICKY, true ) ? $query['sticky'] ?? 'include' : 'include';
			if ( 'include' === $sticky ) {
				$args['ignore_sticky_posts'] = false;
			} elseif ( 'only' === $sticky ) {
				$ids = array_map( 'intval', (array) get_option( 'sticky_posts', [] ) );
				$args['post__in'] = [] === $ids ? [ 0 ] : $ids;
			}
		}

		if ( ! empty( $query['excludeCurrent'] ) && $current > 0 ) {
			$args['post__not_in'] = [ $current ]; // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in -- one id.
		}

		return $args;
	}

	/**
	 * Term filters on taxonomies that belong to the post type and are public. Each value is a term
	 * slug, or a list of them.
	 *
	 * @param array<string, mixed> $taxonomy
	 * @return list<array<string, mixed>>
	 */
	private static function taxQuery( array $taxonomy, string $type ): array {
		$out = [];

		foreach ( $taxonomy as $name => $terms ) {
			$name = sanitize_key( (string) $name );
			$tax = get_taxonomy( $name );

			if ( ! $tax || ! $tax->public || ! in_array( $type, (array) $tax->object_type, true ) ) {
				continue;
			}

			$slugs = array_values( array_filter( array_map( static fn ( $t ): string => sanitize_title( (string) $t ), (array) $terms ) ) );
			if ( [] !== $slugs ) {
				$out[] = [
					'taxonomy' => $name,
					'field' => 'slug',
					'terms' => array_slice( $slugs, 0, 10 ),
				];
			}
		}

		return $out;
	}

	/**
	 * One custom-field filter, on a key a visitor may see ({@see PostFields::publicMeta()}).
	 *
	 * @param array<string, mixed> $meta
	 * @return array<string, mixed>|null
	 */
	private static function metaQuery( array $meta, string $type ): ?array {
		$key = is_string( $meta['key'] ?? null ) ? $meta['key'] : '';
		$op = is_string( $meta['op'] ?? null ) && isset( self::META_COMPARE[ $meta['op'] ] ) ? $meta['op'] : 'is';

		if ( '' === $key || ! PostFields::publicMeta( $key, $type ) ) {
			return null;
		}

		$clause = [
			'key' => $key,
			'compare' => self::META_COMPARE[ $op ],
		];

		if ( ! in_array( $op, [ 'set', 'empty' ], true ) ) {
			$value = ItemPipeline::scalar( $meta['value'] ?? '' );
			$clause['value'] = $value;
			if ( in_array( $op, [ 'gt', 'lt' ], true ) ) {
				$clause['type'] = 'NUMERIC';
			}
		}

		return $clause;
	}

	/**
	 * `orderBy` → WordPress `orderby` and, for `meta:<key>`, the meta key.
	 *
	 * @return array{0: string, 1: string}
	 */
	private static function orderBy( string $orderBy, string $type ): array {
		if ( str_starts_with( $orderBy, 'meta:' ) ) {
			$key = substr( $orderBy, 5 );

			return PostFields::publicMeta( $key, $type ) ? [ 'meta_value', $key ] : [ 'date', '' ];
		}

		return [ in_array( $orderBy, self::ORDER_BY, true ) ? $orderBy : 'date', '' ];
	}

	/** A post a visitor may see: published, no password, readable by the current visitor. */
	private static function visible( WP_Post $post ): bool {
		return 'publish' === $post->post_status && '' === $post->post_password && is_post_publicly_viewable( $post );
	}
}
