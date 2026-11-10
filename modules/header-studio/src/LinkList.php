<?php
/**
 * The Link list block: links read from a WordPress menu or from chosen pages.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Dynamic, so a menu edited in WordPress shows here without touching the header. Each link is
 * written as a Menu link (`bl-menu-link`), so a column of typed links and a column read from a menu
 * look the same.
 *
 * Sources, in the block's `menu` attribute:
 *
 *  - `classic:<menu id>` a classic menu's top-level items; `classic:<menu id>:<item id>` the items
 *    under one of them.
 *  - `nav:<post id>` a block theme's Navigation menu (`wp_navigation`), its top-level links and
 *    submenus; `nav:<post id>:<n>` the links in its n-th submenu (from 0).
 *
 * Or, with `source: pages`, the published pages in `pages`, in that order.
 */
final class LinkList {

	/**
	 * @param array<string, mixed> $attributes
	 */
	public static function render( array $attributes ): string {
		$links = 'pages' === ( $attributes['source'] ?? 'menu' )
			? self::pages( is_array( $attributes['pages'] ?? null ) ? $attributes['pages'] : [] )
			: self::menu( (string) ( $attributes['menu'] ?? '' ) );

		if ( [] === $links ) {
			return '';
		}

		$uid = preg_replace( '/[^a-z0-9]/', '', strtolower( (string) ( $attributes['uniqueId'] ?? '' ) ) );
		$items = '';

		foreach ( $links as $link ) {
			$items .= '<li><a class="bl-menu-link" href="' . esc_url( $link['url'] ) . '"><span class="bl-menu-link__text"><span class="bl-menu-link__label">'
				. esc_html( $link['label'] ) . '</span></span></a></li>';
		}

		return '<ul class="bl-link-list' . ( '' !== $uid ? ' bl-' . esc_attr( $uid ) : '' ) . '">' . $items . '</ul>';
	}

	/**
	 * @param array<mixed> $ids
	 * @return list<array{label: string, url: string}>
	 */
	public static function pages( array $ids ): array {
		$links = [];

		foreach ( $ids as $id ) {
			$post = is_numeric( $id ) ? get_post( (int) $id ) : null;

			if ( $post && 'publish' === $post->post_status && 'page' === $post->post_type ) {
				$links[] = [
					'label' => get_the_title( $post ),
					'url' => (string) get_permalink( $post ),
				];
			}
		}

		return $links;
	}

	/** @return list<array{label: string, url: string}> */
	public static function menu( string $ref ): array {
		if ( 1 === preg_match( '/^classic:(\d+)(?::(\d+))?$/', $ref, $m ) ) {
			return self::classic( (int) $m[1], (int) ( $m[2] ?? 0 ) );
		}

		if ( 1 === preg_match( '/^nav:(\d+)(?::(\d+))?$/', $ref, $m ) ) {
			return self::navigation( (int) $m[1], isset( $m[2] ) ? (int) $m[2] : null );
		}

		return [];
	}

	/** @return list<array{label: string, url: string}> */
	private static function classic( int $menu, int $parent ): array {
		$items = wp_get_nav_menu_items( $menu );
		$links = [];

		foreach ( is_array( $items ) ? $items : [] as $item ) {
			if ( (int) $item->menu_item_parent === $parent ) {
				$links[] = [
					'label' => wp_strip_all_tags( (string) $item->title ),
					'url' => (string) $item->url,
				];
			}
		}

		return $links;
	}

	/** @return list<array{label: string, url: string}> */
	private static function navigation( int $id, ?int $submenu ): array {
		$post = get_post( $id );

		if ( ! $post || 'wp_navigation' !== $post->post_type || 'publish' !== $post->post_status ) {
			return [];
		}

		$blocks = array_values( array_filter( parse_blocks( $post->post_content ), static fn ( $b ): bool => is_string( $b['blockName'] ?? null ) ) );

		if ( null !== $submenu ) {
			$submenus = array_values( array_filter( $blocks, static fn ( $b ): bool => 'core/navigation-submenu' === $b['blockName'] ) );
			$blocks = $submenus[ $submenu ]['innerBlocks'] ?? [];
		}

		$links = [];

		foreach ( $blocks as $block ) {
			if ( in_array( $block['blockName'] ?? '', [ 'core/navigation-link', 'core/navigation-submenu' ], true ) ) {
				$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
				$links[] = [
					'label' => wp_strip_all_tags( (string) ( $attrs['label'] ?? '' ) ),
					'url' => (string) ( $attrs['url'] ?? '' ),
				];
			}
		}

		return $links;
	}
}
