<?php
/**
 * The fields a post offers to a Loop.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use WP_Post;

/**
 * One post as a flat item: the same field names whatever the post type, so a card built for blog
 * posts reads products and custom post types without rebinding.
 *
 * **Custom fields are opt-in.** A post's meta often holds things never meant for a page (edit
 * locks, import ids, a plugin's private state), so only keys registered with `show_in_rest` and
 * not protected (no leading underscore) are offered, plus whatever the `blicks_loop_meta_keys`
 * filter adds for one post type. WooCommerce products get their price, stock and rating through
 * the product API instead, since those live in protected meta.
 */
final class PostFields {

	private function __construct() {}

	/** @return array<string, mixed> */
	public static function item( WP_Post $post ): array {
		$type = $post->post_type;
		$image = (int) get_post_thumbnail_id( $post );
		$imageUrl = $image > 0 ? (string) wp_get_attachment_image_url( $image, 'large' ) : '';
		$author = (int) $post->post_author;

		[ $categories, $tags ] = self::terms( $post );

		$item = [
			'id' => $post->ID,
			'title' => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
			'excerpt' => html_entity_decode( wp_strip_all_tags( get_the_excerpt( $post ) ), ENT_QUOTES, 'UTF-8' ),
			'url' => (string) get_permalink( $post ),
			'date' => (string) get_the_date( 'c', $post ),
			'modified' => (string) get_the_modified_date( 'c', $post ),
			'author' => $author > 0 ? (string) get_the_author_meta( 'display_name', $author ) : '',
			'author_url' => $author > 0 ? (string) get_author_posts_url( $author ) : '',
			'featured_image' => $imageUrl,
			'featured_image_alt' => $image > 0 ? (string) get_post_meta( $image, '_wp_attachment_image_alt', true ) : '',
			'category' => $categories[0] ?? '',
			'categories' => $categories,
			'tags' => $tags,
			'comment_count' => (int) $post->comment_count,
		];

		foreach ( self::metaKeys( $type ) as $key ) {
			if ( ! array_key_exists( $key, $item ) ) {
				$value = get_post_meta( $post->ID, $key, true );
				$item[ $key ] = is_scalar( $value ) ? $value : '';
			}
		}

		if ( 'product' === $type && function_exists( 'wc_get_product' ) ) {
			$item += self::product( $post->ID );
		}

		return $item + self::extra( $item, $post );
	}

	/**
	 * The fields a companion adds to one post's item.
	 *
	 * Additions only: a key the item already has keeps its value, so a filter cannot change what
	 * `url` or `title` mean to every card already built.
	 *
	 * @param array<string, mixed> $item
	 * @return array<string, mixed>
	 */
	private static function extra( array $item, WP_Post $post ): array {
		/**
		 * Filters the extra fields a Loop item gets from one post.
		 *
		 * Return only the fields to add, keyed by name. Keys the item already has are ignored, as are
		 * non-string keys and values that are neither scalar nor arrays. The editor lists a Loop's
		 * fields from its first item, so give every post of a type the same keys, with an empty value
		 * where one has none.
		 *
		 * @param array<string, mixed> $fields Fields to add. Empty by default.
		 * @param WP_Post              $post   The post.
		 * @param array<string, mixed> $item   The item as built so far, read-only.
		 */
		$fields = apply_filters( 'blicks_loop_item', [], $post, $item );
		if ( ! is_array( $fields ) ) {
			return [];
		}

		$out = [];
		foreach ( $fields as $key => $value ) {
			if ( is_string( $key ) && '' !== $key && ! array_key_exists( $key, $item ) && ( is_scalar( $value ) || is_array( $value ) ) ) {
				$out[ $key ] = $value;
			}
		}

		return $out;
	}

	/** Whether a meta key may be read into a page: not protected, and registered for REST or allowed by the filter. */
	public static function publicMeta( string $key, string $type = '' ): bool {
		if ( '' === $key || is_protected_meta( $key, 'post' ) ) {
			return false;
		}

		return in_array( $key, self::metaKeys( $type ), true );
	}

	/**
	 * The custom-field keys offered for a post type.
	 *
	 * @return list<string>
	 */
	public static function metaKeys( string $type ): array {
		$keys = [];

		foreach ( [ '', $type ] as $subtype ) {
			foreach ( get_registered_meta_keys( 'post', $subtype ) as $key => $args ) {
				if ( ! empty( $args['show_in_rest'] ) && ! is_protected_meta( $key, 'post' ) ) {
					$keys[] = (string) $key;
				}
			}
		}

		/**
		 * Filters the custom-field keys a Loop may read from posts of one type.
		 *
		 * Protected keys (a leading underscore) are removed afterwards whatever this returns.
		 *
		 * @param list<string> $keys Registered, REST-visible, unprotected keys.
		 * @param string       $type The post type ('' for keys shared by every type).
		 */
		$keys = apply_filters( 'blicks_loop_meta_keys', $keys, $type );

		return array_values( array_unique( array_filter( (array) $keys, static fn ( $k ): bool => is_string( $k ) && '' !== $k && ! is_protected_meta( $k, 'post' ) ) ) );
	}

	/**
	 * Category-like and tag-like term names: the type's first public hierarchical taxonomy and its
	 * first public flat one (`category`/`post_tag` for posts, `product_cat`/`product_tag` for
	 * products).
	 *
	 * @return array{0: list<string>, 1: list<string>}
	 */
	private static function terms( WP_Post $post ): array {
		$out = [ [], [] ];

		foreach ( get_object_taxonomies( $post->post_type, 'objects' ) as $tax ) {
			if ( ! $tax->public ) {
				continue;
			}

			$slot = $tax->hierarchical ? 0 : 1;
			if ( [] !== $out[ $slot ] ) {
				continue;
			}

			$terms = get_the_terms( $post, $tax->name );
			if ( is_array( $terms ) ) {
				$out[ $slot ] = array_values( array_map( static fn ( $t ): string => html_entity_decode( $t->name, ENT_QUOTES, 'UTF-8' ), $terms ) );
			}
		}

		return $out;
	}

	/** @return array<string, mixed> */
	private static function product( int $id ): array {
		$product = wc_get_product( $id );
		if ( ! $product ) {
			return [];
		}

		return [
			'price' => (float) $product->get_price(),
			'regular_price' => (float) $product->get_regular_price(),
			'sale_price' => '' === $product->get_sale_price() ? '' : (float) $product->get_sale_price(),
			'on_sale' => $product->is_on_sale(),
			'stock' => $product->get_stock_quantity() ?? '',
			'stock_status' => $product->get_stock_status(),
			'rating' => (float) $product->get_average_rating(),
		];
	}
}
