<?php
/**
 * Table-backed store for user-saved block design presets.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Models;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\Database\Model;

/**
 * The `wp_blicks_presets` table: one row per user-saved design preset, keyed by the block type it
 * belongs to (`block_name` — the "block reference") plus a per-block `preset_key`. Attributes are a
 * JSON design bundle. Reads are cached per block; writes bust the cache.
 *
 * Thin table access only — shape validation lives in {@see \Blicks\Presets\Presets}.
 */
final class PresetModel extends Model {

	protected static string $table = 'blicks_presets';

	private const CACHE_GROUP = 'blicks_presets';
	private const SCHEMA_OPTION = 'blicks_presets_schema_version';
	private const SCHEMA_VERSION = '1';

	public static function install(): void {
		self::createTable();
		update_option( self::SCHEMA_OPTION, self::SCHEMA_VERSION, false );
	}

	public static function maybeInstall(): void {
		if ( get_option( self::SCHEMA_OPTION, '' ) !== self::SCHEMA_VERSION ) {
			self::install();
		}
	}

	public static function createTable(): void {
		global $wpdb;

		$charset = $wpdb->get_charset_collate();
		$table = self::table();

		// block_name + preset_key is unique: a preset is addressed by "which block, which key", and
		// the key is generated unique-per-block by the store. Both are capped at 191 so the composite
		// UNIQUE key stays within InnoDB's index-length limit under utf8mb4.
		$sql = "CREATE TABLE IF NOT EXISTS {$table} (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            block_name  VARCHAR(191)    NOT NULL,
            preset_key  VARCHAR(191)    NOT NULL,
            title       VARCHAR(191)    NOT NULL,
            attributes  LONGTEXT        NOT NULL,
            author      BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY block_preset (block_name, preset_key),
            KEY block_name (block_name)
        ) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}

	/**
	 * Every preset, grouped by block name — the shape the editor bootstrap and REST index return.
	 *
	 * @return array<string, list<array{id:int,key:string,title:string,attributes:array<string,mixed>,author:int}>>
	 */
	public static function grouped(): array {
		$grouped = [];
		foreach ( self::allRows() as $row ) {
			$grouped[ $row['block_name'] ][] = self::shape( $row );
		}

		return $grouped;
	}

	/**
	 * @return list<array{id:int,key:string,title:string,attributes:array<string,mixed>,author:int}>
	 */
	public static function forBlock( string $blockName ): array {
		$cached = self::cacheGet( $blockName );
		if ( null !== $cached ) {
			return $cached;
		}

		global $wpdb;
		$table = self::table();
		// $table is $wpdb->prefix . a class constant — no user input, and an identifier cannot be
		// bound as a placeholder. $blockName is bound with %s. Result cached on the next lines.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->prepare( "SELECT * FROM {$table} WHERE block_name = %s ORDER BY title ASC", $blockName ),
			ARRAY_A
		);

		$out = is_array( $rows ) ? array_map( [ self::class, 'shape' ], $rows ) : [];
		self::cacheSet( $blockName, $out );

		return $out;
	}

	/** @return array{id:int,block_name:string,preset_key:string,title:string,attributes:array<string,mixed>,author:int}|null */
	public static function findRow( int $id ): ?array {
		global $wpdb;
		$table = self::table();
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d LIMIT 1", $id ), ARRAY_A );
		if ( ! is_array( $row ) ) {
			return null;
		}

		return [
			'id' => (int) $row['id'],
			'block_name' => (string) $row['block_name'],
			'preset_key' => (string) $row['preset_key'],
			'title' => (string) $row['title'],
			'attributes' => self::decodeAttributes( (string) $row['attributes'] ),
			'author' => (int) $row['author'],
		];
	}

	/** True when a key is already taken for this block (used to generate a unique key). */
	public static function keyExists( string $blockName, string $key ): bool {
		global $wpdb;
		$table = self::table();
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$found = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE block_name = %s AND preset_key = %s LIMIT 1", $blockName, $key ) );

		return null !== $found;
	}

	public static function count(): int {
		global $wpdb;
		$table = self::table();
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );
	}

	/**
	 * @param array<string,mixed> $attributes
	 * @return int The new row id.
	 */
	public static function insertRow( string $blockName, string $key, string $title, array $attributes, int $author ): int {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wpdb->insert() escapes via format specifiers; cache busted below.
		$wpdb->insert(
			self::table(),
			[
				'block_name' => $blockName,
				'preset_key' => $key,
				'title' => $title,
				'attributes' => self::encodeAttributes( $attributes ),
				'author' => $author,
			],
			[ '%s', '%s', '%s', '%s', '%d' ]
		);
		self::cacheDelete( $blockName );

		return (int) $wpdb->insert_id;
	}

	/** @param array<string,mixed> $attributes */
	public static function updateRow( int $id, string $blockName, string $key, string $title, array $attributes ): void {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wpdb->update() escapes via format specifiers; cache busted below.
		$wpdb->update(
			self::table(),
			[
				'preset_key' => $key,
				'title' => $title,
				'attributes' => self::encodeAttributes( $attributes ),
			],
			[ 'id' => $id ],
			[ '%s', '%s', '%s' ],
			[ '%d' ]
		);
		self::cacheDelete( $blockName );
	}

	public static function deleteRow( int $id, string $blockName ): void {
		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wpdb->delete() escapes via format specifiers; cache busted below.
		$wpdb->delete( self::table(), [ 'id' => $id ], [ '%d' ] );
		self::cacheDelete( $blockName );
	}

	/**
	 * @return list<array<string,string>>
	 */
	private static function allRows(): array {
		global $wpdb;
		$table = self::table();
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$rows = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY block_name ASC, title ASC", ARRAY_A );

		return is_array( $rows ) ? $rows : [];
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array{id:int,key:string,title:string,attributes:array<string,mixed>,author:int}
	 */
	private static function shape( array $row ): array {
		return [
			'id' => (int) ( $row['id'] ?? 0 ),
			'key' => (string) ( $row['preset_key'] ?? '' ),
			'title' => (string) ( $row['title'] ?? '' ),
			'attributes' => self::decodeAttributes( (string) ( $row['attributes'] ?? '' ) ),
			'author' => (int) ( $row['author'] ?? 0 ),
		];
	}

	/** @param array<string,mixed> $attributes */
	private static function encodeAttributes( array $attributes ): string {
		$encoded = wp_json_encode( $attributes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		return $encoded ? $encoded : '{}';
	}

	/** @return array<string,mixed> */
	private static function decodeAttributes( string $raw ): array {
		if ( '' === trim( $raw ) ) {
			return [];
		}

		$decoded = json_decode( $raw, true );

		return is_array( $decoded ) ? $decoded : [];
	}

	/** @return list<array<string,mixed>>|null */
	private static function cacheGet( string $blockName ): ?array {
		if ( ! function_exists( 'wp_cache_get' ) ) {
			return null;
		}
		$found = false;
		$value = wp_cache_get( $blockName, self::CACHE_GROUP, false, $found );

		return $found && is_array( $value ) ? $value : null;
	}

	/** @param list<array<string,mixed>> $value */
	private static function cacheSet( string $blockName, array $value ): void {
		if ( function_exists( 'wp_cache_set' ) ) {
			wp_cache_set( $blockName, $value, self::CACHE_GROUP );
		}
	}

	private static function cacheDelete( string $blockName ): void {
		if ( function_exists( 'wp_cache_delete' ) ) {
			wp_cache_delete( $blockName, self::CACHE_GROUP );
		}
	}
}
