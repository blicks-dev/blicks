<?php
/**
 * Where a saved dialog is opened from.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A Button saves `commandfor="dialog-<anchor>"` and a link `href="#dialog-<anchor>"`, so the posts
 * that open a saved dialog are found by searching saved content for those two strings. Answers the
 * Studio's "Used on N pages" (`blicks_studio_entity_used_on`) and the Dialogs view's "opened by
 * 4 buttons on 3 pages".
 */
final class Openers {

	/** How many posts one search reads at most. */
	private const LIMIT = 200;

	/**
	 * How many openers a piece of content holds for this dialog.
	 */
	public static function count( string $content, string $domId ): int {
		$quoted = preg_quote( $domId, '/' );

		return (int) preg_match_all( '/(?:commandfor="' . $quoted . '"|href="#' . $quoted . '")/', $content );
	}

	/**
	 * The published posts that open the dialog, each with how many openers it holds.
	 *
	 * @return list<array{id: string, title: string, kind: string, count: int}>
	 */
	public static function find( string $domId ): array {
		global $wpdb;

		if ( 1 !== preg_match( '/^dialog-[a-z0-9-]+$/', $domId ) ) {
			return [];
		}

		$cacheKey = 'openers:' . $domId;
		$cached = wp_cache_get( $cacheKey, 'blicks-pro-dialogs' );

		if ( is_array( $cached ) ) {
			return $cached;
		}

		$like = '%' . $wpdb->esc_like( $domId ) . '%';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- a content search no WP_Query argument expresses; cached below.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ID, post_title, post_type, post_content FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type NOT IN ( 'revision', %s ) AND post_content LIKE %s ORDER BY ID ASC LIMIT %d",
				Library::TYPE,
				$like,
				self::LIMIT
			)
		);

		$out = [];

		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$count = self::count( (string) $row->post_content, $domId );

			if ( $count > 0 ) {
				$out[] = [
					'id' => (string) $row->ID,
					'title' => '' !== (string) $row->post_title ? (string) $row->post_title : __( '(no title)', 'blicks-pro' ),
					'kind' => (string) $row->post_type,
					'count' => $count,
				];
			}
		}

		wp_cache_set( $cacheKey, $out, 'blicks-pro-dialogs', MINUTE_IN_SECONDS );

		return $out;
	}

	/**
	 * `blicks_studio_entity_used_on` for a saved dialog.
	 *
	 * @param mixed                $used
	 * @param array<string, mixed> $ref
	 * @return mixed
	 */
	public static function usedOn( mixed $used, mixed $ref ): mixed {
		if ( ! is_array( $ref ) || Library::TYPE !== ( $ref['type'] ?? null ) ) {
			return $used;
		}

		$domId = (string) get_post_meta( (int) ( $ref['id'] ?? 0 ), Library::DOM_ID, true );

		return [ ...( is_array( $used ) ? $used : [] ), ...self::find( $domId ) ];
	}
}
