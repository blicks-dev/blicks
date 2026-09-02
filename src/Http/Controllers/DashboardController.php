<?php
/**
 * REST controller for the admin Overview summary.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\Plugin as BasePlugin;
use Blicks\DesignSystem\DesignThemes;
use Blicks\Settings\AdminSettings;
use WP_REST_Response;

/**
 * Serves the admin Overview summary.
 */
final class DashboardController {

	private const USAGE_TRANSIENT = 'blicks_dashboard_usage';

	public static function summary(): WP_REST_Response {
		return new WP_REST_Response(
			[
				'blocks' => self::blockSummary(),
				'usage' => self::usage(),
				'activity' => self::activity(),
			],
			200
		);
	}

	/**
	 * Recent activity, built only from timestamps this install actually recorded. An event
	 * with no stored time is omitted — the dashboard never invents one.
	 *
	 * @return list<array{id:string,label:string,detail:string,time:string}>
	 */
	private static function activity(): array {
		$entries = [];

		$tokensAt = self::globalStylesModifiedAt();
		if ( null !== $tokensAt ) {
			$entries[] = [
				'id' => 'design-tokens',
				'label' => __( 'Design tokens saved', 'blicks' ),
				'detail' => self::activeThemeName(),
				'time' => $tokensAt,
			];
		}

		$settingsAt = AdminSettings::updatedAt();
		if ( null !== $settingsAt ) {
			$entries[] = [
				'id' => 'settings',
				'label' => __( 'Plugin settings saved', 'blicks' ),
				'detail' => __( 'Blicks → Settings', 'blicks' ),
				'time' => $settingsAt,
			];
		}

		usort( $entries, static fn ( array $a, array $b ): int => strcmp( $b['time'], $a['time'] ) );

		return $entries;
	}

	private static function globalStylesModifiedAt(): ?string {
		if ( ! class_exists( 'WP_Theme_JSON_Resolver' )
			|| ! method_exists( 'WP_Theme_JSON_Resolver', 'get_user_global_styles_post_id' ) ) {
			return null;
		}

		$postId = (int) \WP_Theme_JSON_Resolver::get_user_global_styles_post_id();
		if ( $postId <= 0 ) {
			return null;
		}

		$modified = get_post_field( 'post_modified_gmt', $postId );

		return is_string( $modified ) && '' !== $modified && '0000-00-00 00:00:00' !== $modified
			? gmdate( DATE_ATOM, (int) strtotime( $modified . ' UTC' ) )
			: null;
	}

	private static function activeThemeName(): string {
		if ( ! class_exists( DesignThemes::class ) ) {
			return __( 'Active design theme', 'blicks' );
		}

		$active = DesignThemes::find( DesignThemes::all()['active'] );

		return is_array( $active ) && is_string( $active['name'] ?? null ) && '' !== $active['name']
			? $active['name']
			: __( 'Active design theme', 'blicks' );
	}

	/**
	 * How much of the site actually uses Blicks — the one setup step the plugin cannot
	 * satisfy on the user's behalf, so the Overview checklist needs a real answer rather
	 * than an assumption. Counts content containing a Blicks block delimiter.
	 *
	 * Cached for five minutes: this is a LIKE over `post_content`, which cannot use an
	 * index, so it is a table scan on a large site and the dashboard is not worth one on
	 * every load. `false` from the transient means "not cached", which a real 0 would be
	 * indistinguishable from, so the cached payload is an array.
	 *
	 * @return array{posts:int}
	 */
	private static function usage(): array {
		$cached = get_transient( self::USAGE_TRANSIENT );
		if ( is_array( $cached ) && isset( $cached['posts'] ) && is_int( $cached['posts'] ) ) {
			return $cached;
		}

		global $wpdb;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Cached in a transient directly below; no core API counts blocks in content.
		$posts = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(ID) FROM {$wpdb->posts}
                 WHERE post_content LIKE %s
                   AND post_status NOT IN ('trash', 'auto-draft', 'inherit')
                   AND post_type NOT IN ('revision', 'nav_menu_item')",
				'%' . $wpdb->esc_like( '<!-- wp:blicks/' ) . '%'
			)
		);

		$usage = [ 'posts' => $posts ];
		set_transient( self::USAGE_TRANSIENT, $usage, 5 * MINUTE_IN_SECONDS );

		return $usage;
	}

	/** @return array{total:int,interactive:int} */
	private static function blockSummary(): array {
		$blocksDir = BasePlugin::path( 'build/blocks' );
		if ( ! is_dir( $blocksDir ) ) {
			return [
				'total' => 0,
				'interactive' => 0,
			];
		}

		$total = 0;
		$interactive = 0;

		foreach ( new \DirectoryIterator( $blocksDir ) as $item ) {
			if ( ! $item->isDir() || $item->isDot() ) {
				continue;
			}

			$metadataFile = $item->getPathname() . '/block.json';
			if ( ! is_file( $metadataFile ) ) {
				continue;
			}

            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reads a block.json bundled with the plugin, not a remote URL.
			$metadata = json_decode( (string) file_get_contents( $metadataFile ), true );
			if ( ! is_array( $metadata ) ) {
				continue;
			}

			++$total;
			$supports = is_array( $metadata['supports'] ?? null ) ? $metadata['supports'] : [];
			if ( true === ( $supports['interactivity'] ?? false ) ) {
				++$interactive;
			}
		}

		return [
			'total' => $total,
			'interactive' => $interactive,
		];
	}
}
