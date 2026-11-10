<?php
/**
 * Blicks › Dialogs: every saved dialog in one list.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The page is the free admin app's, through `blicks_admin_views`; its contents are this module's
 * `resources/admin.tsx`, fed by one route that answers the whole list with what each row shows.
 */
final class AdminView {

	public const SLUG = 'blicks-dialogs';

	public const VIEW = 'dialogs';

	/**
	 * @param mixed $views
	 * @return mixed
	 */
	public static function views( mixed $views ): mixed {
		if ( ! is_array( $views ) ) {
			return $views;
		}

		$views[ self::SLUG ] = [
			'view' => self::VIEW,
			'label' => __( 'Dialogs', 'blicks-pro' ),
			'capability' => 'edit_theme_options',
		];

		return $views;
	}

	/** Whether the admin screen being drawn is this view's. */
	public static function current(): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- which screen this is; read-only.
		return isset( $_GET['page'] ) && self::SLUG === sanitize_key( wp_unslash( (string) $_GET['page'] ) );
	}

	public static function routes(): void {
		register_rest_route(
			Stats::NS,
			'/dialogs',
			[
				'methods' => WP_REST_Server::READABLE,
				'callback' => [ self::class, 'list' ],
				'permission_callback' => static fn (): bool => current_user_can( 'edit_theme_options' ),
			]
		);
	}

	/**
	 * One row per saved dialog, published and drafts.
	 *
	 * @return list<array<string, mixed>>
	 */
	public static function rows(): array {
		$rows = [];

		foreach (
			get_posts(
				[
					'post_type' => Library::TYPE,
					'post_status' => [ 'publish', 'draft' ],
					// phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_numberposts -- an admin list of a site's dialogs, which are few.
					'numberposts' => 200,
					'orderby' => 'title',
					'order' => 'ASC',
					'no_found_rows' => true,
				]
			) as $post
		) {
			$domId = (string) get_post_meta( $post->ID, Library::DOM_ID, true );
			$attrs = [];

			foreach ( parse_blocks( (string) $post->post_content ) as $block ) {
				if ( 'blicks/dialog' === ( $block['blockName'] ?? null ) ) {
					$attrs = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : [];
					break;
				}
			}

			$openers = Openers::find( $domId );
			$stats = Stats::read( (int) $post->ID, 30 );

			$rows[] = [
				'id' => (int) $post->ID,
				'title' => (string) $post->post_title,
				'on' => 'publish' === $post->post_status,
				'domId' => $domId,
				'kind' => is_string( $attrs['kind'] ?? null ) ? $attrs['kind'] : 'modal',
				'modal' => false !== ( $attrs['modal'] ?? true ),
				'triggers' => Settings::triggers( get_post_meta( $post->ID, Settings::TRIGGERS, true ) ),
				'rules' => Settings::rules( get_post_meta( $post->ID, Settings::RULES, true ) ),
				'openers' => [
					'buttons' => array_sum( array_column( $openers, 'count' ) ),
					'pages' => count( $openers ),
				],
				'shown' => $stats['shown'],
				'converted' => $stats['converted'],
			];
		}

		return $rows;
	}

	public static function list(): WP_REST_Response {
		return new WP_REST_Response(
			[
				'dialogs' => self::rows(),
				'editUrl' => admin_url( 'post.php?action=edit&post=' ),
				'newUrl' => admin_url( 'post-new.php?post_type=' . Library::TYPE ),
			],
			200
		);
	}
}
