<?php
/**
 * Blicks › Headers: the site's header template parts in one list.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

use Blicks\Studio\EntityRef;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The page is the free admin app's, through `blicks_admin_views`; its contents are this module's
 * `resources/admin.tsx`, fed by one route: every template part in the header area, whether it is a
 * Header Studio header yet, and which templates use it.
 */
final class AdminView {

	public const SLUG = 'blicks-headers';

	public const VIEW = 'headers';

	public const NS = 'blicks-pro/v1';

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
			'label' => __( 'Headers', 'blicks-pro' ),
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
			self::NS,
			'/headers',
			[
				'methods' => WP_REST_Server::READABLE,
				'callback' => [ self::class, 'list' ],
				'permission_callback' => static fn (): bool => current_user_can( 'edit_theme_options' ),
			]
		);
	}

	/**
	 * One row per header template part of the active theme.
	 *
	 * @return list<array{id: string, title: string, slug: string, custom: bool, studio: bool, usedOn: list<array{id: string, title: string, kind: string}>}>
	 */
	public static function rows(): array {
		if ( ! function_exists( 'get_block_templates' ) || ! wp_is_block_theme() ) {
			return [];
		}

		$rows = [];

		foreach ( get_block_templates( [ 'area' => 'header' ], 'wp_template_part' ) as $part ) {
			$id = (string) $part->id;
			$rows[] = [
				'id' => $id,
				'title' => '' !== (string) $part->title ? (string) $part->title : (string) $part->slug,
				'slug' => (string) $part->slug,
				'custom' => 'theme' !== $part->source,
				'studio' => str_contains( (string) $part->content, '<!-- wp:blicks/header' ),
				'usedOn' => EntityRef::usedOn(
					[
						'kind' => 'template-part',
						'id' => $id,
					]
				),
			];
		}

		usort( $rows, static fn ( array $a, array $b ): int => strcasecmp( $a['title'], $b['title'] ) );

		return $rows;
	}

	public static function list(): WP_REST_Response {
		return new WP_REST_Response(
			[
				'headers' => self::rows(),
				'blockTheme' => wp_is_block_theme(),
			],
			200
		);
	}
}
