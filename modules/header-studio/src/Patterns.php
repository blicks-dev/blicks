<?php
/**
 * Header patterns: the Studio's starting headers, offered where WordPress offers header designs.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Every starting header — the layouts (Classic, Centred, Stacked) and the designed starters — as
 * saved markup in `patterns/<layout>.html` (written from the Studio's own starters and held to them
 * by `tests/studio.test.ts`). Registered for the header
 * template part, so the Site Editor lists them when a header's design is chosen, and agents can
 * start a header from one ({@see Agents}).
 */
final class Patterns {

	public const LAYOUTS = [ 'classic', 'centred', 'stacked', 'minimal-centred', 'classic-split', 'announcement-bar', 'sticky-shrink', 'hide-on-scroll', 'search-first', 'simple-dropdown', 'two-tier-utility', 'mega-menu-columns' ];

	public function __construct( private readonly string $dir ) {
	}

	/** A layout's markup, or '' when there is no such layout. */
	public function markup( string $layout ): string {
		$file = $this->dir . '/patterns/' . $layout . '.html';

		return in_array( $layout, self::LAYOUTS, true ) && is_readable( $file ) ? (string) file_get_contents( $file ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file.
	}

	public function register(): void {
		if ( ! function_exists( 'register_block_pattern' ) ) {
			return;
		}

		$titles = [
			'classic' => __( 'Header Studio: Classic', 'blicks-pro' ),
			'centred' => __( 'Header Studio: Centered', 'blicks-pro' ),
			'stacked' => __( 'Header Studio: Stacked', 'blicks-pro' ),
			'minimal-centred' => __( 'Header Studio: Minimal centered', 'blicks-pro' ),
			'classic-split' => __( 'Header Studio: Classic split', 'blicks-pro' ),
			'announcement-bar' => __( 'Header Studio: Announcement bar', 'blicks-pro' ),
			'sticky-shrink' => __( 'Header Studio: Over the hero', 'blicks-pro' ),
			'hide-on-scroll' => __( 'Header Studio: Hide on scroll', 'blicks-pro' ),
			'search-first' => __( 'Header Studio: Search first', 'blicks-pro' ),
			'simple-dropdown' => __( 'Header Studio: Simple dropdown', 'blicks-pro' ),
			'two-tier-utility' => __( 'Header Studio: Two tiers', 'blicks-pro' ),
			'mega-menu-columns' => __( 'Header Studio: Mega menu, columns', 'blicks-pro' ),
		];

		foreach ( self::LAYOUTS as $layout ) {
			$content = $this->markup( $layout );

			if ( '' === $content ) {
				continue;
			}

			register_block_pattern(
				'blicks-pro/header-' . $layout,
				[
					'title' => $titles[ $layout ],
					'description' => __( 'A site header with a menu, a mega menu and a phone drawer, edited in Header Studio.', 'blicks-pro' ),
					'content' => $content,
					'categories' => [ 'header' ],
					'blockTypes' => [ 'core/template-part/header' ],
				]
			);
		}
	}
}
