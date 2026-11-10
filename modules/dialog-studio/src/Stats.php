<?php
/**
 * Daily counts per saved dialog: how often it was shown, and how often it converted.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

use WP_Error;
use WP_Post;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One row per dialog per day in `{prefix}blicks_dialog_stats`, and nothing about who: no visitor
 * id, no IP, no address. The browser sends one beacon when a saved dialog opens and one when it
 * converts (`resources/view/auto.ts`).
 *
 * The route that takes them is public and unauthenticated, as it must be for a cached page's
 * visitors, so the counts can be inflated by anyone who calls it; the Results tab says so. It is
 * rate-limited per address in a transient, keyed by a salted hash that expires with the window.
 */
final class Stats {

	public const NS = 'blicks-pro/v1';

	/** Bumped when the table's shape changes. */
	private const SCHEMA = '1';

	private const SCHEMA_OPTION = 'blicks_pro_dialog_stats_schema';

	/** Events one address may send in a window. */
	public const LIMIT = 30;

	public const WINDOW = 10 * MINUTE_IN_SECONDS;

	public const EVENTS = [ 'shown', 'converted' ];

	public static function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'blicks_dialog_stats';
	}

	/** Create or update the table when its shape is not the one this code expects. */
	public static function install(): void {
		if ( self::SCHEMA === get_option( self::SCHEMA_OPTION ) ) {
			return;
		}

		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table = self::table();
		$charset = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
				dialog_id bigint(20) unsigned NOT NULL,
				day date NOT NULL,
				shown int(10) unsigned NOT NULL DEFAULT 0,
				converted int(10) unsigned NOT NULL DEFAULT 0,
				PRIMARY KEY  (dialog_id,day)
			) {$charset};"
		);

		update_option( self::SCHEMA_OPTION, self::SCHEMA, false );
	}

	/** Add one to today's row. */
	public static function record( int $dialogId, string $event ): bool {
		global $wpdb;

		if ( ! in_array( $event, self::EVENTS, true ) ) {
			return false;
		}

		self::install();
		$table = self::table();
		$day = wp_date( 'Y-m-d' );
		$shown = 'shown' === $event ? 1 : 0;
		$converted = 1 - $shown;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- the plugin's own counter table; an upsert no API offers.
		$done = $wpdb->query(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the table name is ours.
				"INSERT INTO {$table} (dialog_id, day, shown, converted) VALUES (%d, %s, %d, %d) ON DUPLICATE KEY UPDATE shown = shown + VALUES(shown), converted = converted + VALUES(converted)",
				$dialogId,
				$day,
				$shown,
				$converted
			)
		);

		return false !== $done;
	}

	/**
	 * The last `$days` days of one dialog, oldest first, every day present.
	 *
	 * @return array{days: list<array{day: string, shown: int, converted: int}>, shown: int, converted: int}
	 */
	public static function read( int $dialogId, int $days ): array {
		global $wpdb;

		self::install();
		$days = max( 1, min( 365, $days ) );
		$table = self::table();
		$first = wp_date( 'Y-m-d', time() - ( $days - 1 ) * DAY_IN_SECONDS );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- the plugin's own counter table, read for one admin screen.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the table name is ours.
				"SELECT day, shown, converted FROM {$table} WHERE dialog_id = %d AND day >= %s ORDER BY day ASC",
				$dialogId,
				$first
			),
			ARRAY_A
		);

		$byDay = [];

		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$byDay[ (string) $row['day'] ] = [ (int) $row['shown'], (int) $row['converted'] ];
		}

		$out = [];
		$total = [ 0, 0 ];

		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$day = wp_date( 'Y-m-d', time() - $i * DAY_IN_SECONDS );
			[ $shown, $converted ] = $byDay[ $day ] ?? [ 0, 0 ];
			$out[] = [
				'day' => (string) $day,
				'shown' => $shown,
				'converted' => $converted,
			];
			$total[0] += $shown;
			$total[1] += $converted;
		}

		return [
			'days' => $out,
			'shown' => $total[0],
			'converted' => $total[1],
		];
	}

	/**
	 * Whether this address may send another event now; counts it if so.
	 */
	public static function allow( string $address ): bool {
		$key = 'blicks_ds_rl_' . substr( hash_hmac( 'sha256', $address, wp_salt( 'nonce' ) ), 0, 32 );
		$sent = (int) get_transient( $key );

		if ( $sent >= self::LIMIT ) {
			return false;
		}

		set_transient( $key, $sent + 1, self::WINDOW );

		return true;
	}

	/* ------------------------------------------------------------------ REST */

	public static function routes(): void {
		register_rest_route(
			self::NS,
			'/dialogs/(?P<id>\d+)/events',
			[
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => [ self::class, 'event' ],
				// Public on purpose: a cached page's visitors are anonymous. Rate-limited in the callback.
				'permission_callback' => '__return_true',
				'args' => [
					'event' => [
						'type' => 'string',
						'enum' => self::EVENTS,
						'required' => true,
					],
				],
			]
		);

		register_rest_route(
			self::NS,
			'/dialogs/(?P<id>\d+)/stats',
			[
				'methods' => WP_REST_Server::READABLE,
				'callback' => [ self::class, 'stats' ],
				'permission_callback' => static fn (): bool => current_user_can( 'edit_theme_options' ),
				'args' => [
					'days' => [
						'type' => 'integer',
						'default' => 30,
						'minimum' => 1,
						'maximum' => 365,
					],
				],
			]
		);
	}

	public static function event( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = get_post( (int) $request['id'] );

		if ( ! $post instanceof WP_Post || Library::TYPE !== $post->post_type || 'publish' !== $post->post_status ) {
			return new WP_Error( 'blicks_dialog_missing', __( 'No such dialog.', 'blicks-pro' ), [ 'status' => 404 ] );
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated -- REMOTE_ADDR is set by the server; only its salted hash is kept, and only for the window.
		$address = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) ) : '';

		if ( ! self::allow( $address ) ) {
			return new WP_Error( 'blicks_dialog_busy', __( 'Too many events. Try again later.', 'blicks-pro' ), [ 'status' => 429 ] );
		}

		self::record( (int) $post->ID, (string) $request['event'] );

		return new WP_REST_Response( null, 204 );
	}

	public static function stats( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$post = get_post( (int) $request['id'] );

		if ( ! $post instanceof WP_Post || Library::TYPE !== $post->post_type ) {
			return new WP_Error( 'blicks_dialog_missing', __( 'No such dialog.', 'blicks-pro' ), [ 'status' => 404 ] );
		}

		return new WP_REST_Response( self::read( (int) $post->ID, (int) $request['days'] ), 200 );
	}
}
