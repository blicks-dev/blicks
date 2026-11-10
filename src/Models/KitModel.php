<?php
/**
 * Table-backed store for design kits.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Models;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One row per kit in `{prefix}blicks_kits`. Kits are records someone adds, renames and deletes, so
 * they get a table of their own rather than a list inside one settings value. The whole list is
 * small and read whole, so it is cached whole and dropped on every write.
 */
final class KitModel {

	private const TABLE = 'blicks_kits';
	private const CACHE_GROUP = 'blicks_kits';
	private const CACHE_KEY = 'all';

	/** This model's prefixed table name. */
	public static function table(): string {
		global $wpdb;

		return $wpdb->prefix . self::TABLE;
	}

	/** Created by {@see SettingModel::install()}, under the one schema version every Blicks table shares. */
	public static function createTable(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();
		$table = self::table();

		// No IF NOT EXISTS, for the reason SettingModel::createTable() gives: dbDelta() would read
		// the table name as "IF" and stop diffing the schema.
		$sql = "CREATE TABLE {$table} (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            uid        VARCHAR(32)     NOT NULL,
            name       VARCHAR(191)    NOT NULL,
            language   VARCHAR(64)     NOT NULL DEFAULT '',
            palette    VARCHAR(64)     NOT NULL DEFAULT '',
            kit_values LONGTEXT        NOT NULL,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY uid (uid)
        ) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}

	/**
	 * Every kit, oldest first, with its values decoded.
	 *
	 * @return list<array{uid: string, name: string, language: string, palette: string, values: array<string, mixed>}>
	 */
	public static function all(): array {
		if ( function_exists( 'wp_cache_get' ) ) {
			$found = false;
			$cached = wp_cache_get( self::CACHE_KEY, self::CACHE_GROUP, false, $found );
			if ( $found && is_array( $cached ) ) {
				return $cached;
			}
		}

		global $wpdb;
		$table = self::table();
		// $table is $wpdb->prefix . a class constant — no user input, and SQL cannot bind an
		// identifier. There is nothing else to bind. Cached above and below.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results( "SELECT uid, name, language, palette, kit_values FROM {$table} ORDER BY id ASC", ARRAY_A );

		$kits = [];
		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$values = json_decode( (string) ( $row['kit_values'] ?? '' ), true );
			$kits[] = [
				'uid' => (string) ( $row['uid'] ?? '' ),
				'name' => (string) ( $row['name'] ?? '' ),
				'language' => (string) ( $row['language'] ?? '' ),
				'palette' => (string) ( $row['palette'] ?? '' ),
				'values' => is_array( $values ) ? $values : [],
			];
		}

		if ( function_exists( 'wp_cache_set' ) ) {
			wp_cache_set( self::CACHE_KEY, $kits, self::CACHE_GROUP );
		}

		return $kits;
	}

	/** @param array<string, mixed> $values */
	public static function insert( string $uid, string $name, string $language, string $palette, array $values ): void {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- $wpdb->insert() escapes via format specifiers; the cache is dropped on the next line.
		$wpdb->insert(
			self::table(),
			[
				'uid' => $uid,
				'name' => $name,
				'language' => $language,
				'palette' => $palette,
				'kit_values' => (string) wp_json_encode( $values, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
			],
			[ '%s', '%s', '%s', '%s', '%s' ]
		);
		self::flush();
	}

	public static function rename( string $uid, string $name ): void {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wpdb->update() escapes via format specifiers; the cache is dropped on the next line.
		$wpdb->update( self::table(), [ 'name' => $name ], [ 'uid' => $uid ], [ '%s' ], [ '%s' ] );
		self::flush();
	}

	public static function delete( string $uid ): void {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wpdb->delete() escapes via format specifiers; the cache is dropped on the next line.
		$wpdb->delete( self::table(), [ 'uid' => $uid ], [ '%s' ] );
		self::flush();
	}

	private static function flush(): void {
		if ( function_exists( 'wp_cache_delete' ) ) {
			wp_cache_delete( self::CACHE_KEY, self::CACHE_GROUP );
		}
	}
}
