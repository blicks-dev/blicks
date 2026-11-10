<?php
/**
 * Table-backed store for the plugin's settings.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Models;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Table-backed, cached store for the plugin's settings.
 */
final class SettingModel {

	private const TABLE = 'blicks_settings';

	private const CACHE_GROUP = 'blicks_settings';
	private const NOT_FOUND = '__blicks_setting_not_found__';
	private const SCHEMA_OPTION = 'blicks_settings_schema_version';
	/** One version for every Blicks table: bumping it re-runs dbDelta on all of them. */
	private const SCHEMA_VERSION = '3';

	/** @var array<string, mixed> */
	private static array $runtimeCache = [];

	/** This model's prefixed table name. */
	public static function table(): string {
		global $wpdb;

		return $wpdb->prefix . self::TABLE;
	}

	/**
	 * Settings an earlier version stored and nothing reads any more. Deleted whenever the schema
	 * version changes, which every 1.x site's upgrade to 2.0 does.
	 */
	private const RETIRED_KEYS = [
		'admin.default_inspector_panel',
		'admin.help_visibility',
	];

	public static function install(): void {
		self::createTable();
		KitModel::createTable();

		foreach ( self::RETIRED_KEYS as $key ) {
			self::deleteValue( $key );
		}

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

		// No IF NOT EXISTS. dbDelta() extracts the table name with |CREATE TABLE ([^ ]*)|,
		// so the guard makes it read the name as "IF": the raw query still creates the table,
		// but schema diffing silently stops working and no later column change ever applies
		// on upgrade. dbDelta is already idempotent, which is what the guard was there for.
		$sql = "CREATE TABLE {$table} (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            setting_key   VARCHAR(191)    NOT NULL,
            setting_value LONGTEXT        NOT NULL,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY setting_key (setting_key)
        ) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}

	public static function getValue( string $key, mixed $default = null ): mixed {
		$key = self::normalizeKey( $key );
		if ( '' === $key ) {
			return $default;
		}

		$cached = self::cacheGet( $key );
		if ( self::NOT_FOUND !== $cached ) {
			return $cached;
		}

		global $wpdb;
		$table = self::table();
		// $table is $wpdb->prefix . a class constant — no user input, and SQL cannot bind an
		// identifier as a placeholder. $key is bound with %s. Results are cached above/below
		// via cacheGet()/cacheSet(), which wrap wp_cache_*.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$raw = $wpdb->get_var( $wpdb->prepare( "SELECT setting_value FROM {$table} WHERE setting_key = %s LIMIT 1", $key ) );

		if ( ! is_string( $raw ) ) {
			self::cacheSet( $key, $default );
			return $default;
		}

		$value = self::decode( $raw, $default );
		self::cacheSet( $key, $value );

		return $value;
	}

	public static function setValue( string $key, mixed $value ): void {
		$key = self::normalizeKey( $key );
		if ( '' === $key ) {
			return;
		}

		global $wpdb;
		$table = self::table();
		$encoded = self::encode( $value );

		// As above: identifier interpolated, both values bound. Cache is refreshed on the next line.
        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (setting_key, setting_value) VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP",
				$key,
				$encoded
			)
		);
        // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter

		self::cacheSet( $key, $value );
	}

	/**
	 * A value that used to live in a wp_option. The first read copies the option into this table
	 * and deletes it; every read after that is the table's. Nothing stored is lost on the way.
	 */
	public static function adoptOption( string $option, string $key, mixed $default ): mixed {
		$value = self::getValue( $key, null );
		if ( null !== $value ) {
			return $value;
		}

		$legacy = function_exists( 'get_option' ) ? get_option( $option, null ) : null;
		if ( null === $legacy || false === $legacy ) {
			return $default;
		}

		self::setValue( $key, $legacy );
		if ( function_exists( 'delete_option' ) ) {
			delete_option( $option );
		}

		return $legacy;
	}

	public static function deleteValue( string $key ): void {
		$key = self::normalizeKey( $key );
		if ( '' === $key ) {
			return;
		}

		global $wpdb;
		$table = self::table();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wpdb->delete() escapes via format specifiers; cache cleared on the next line.
		$wpdb->delete( $table, [ 'setting_key' => $key ], [ '%s' ] );
		self::cacheDelete( $key );
	}

	private static function normalizeKey( string $key ): string {
		return preg_replace( '/[^a-z0-9_.:-]/', '', strtolower( trim( $key ) ) ) ?? '';
	}

	private static function encode( mixed $value ): string {
		if ( is_string( $value ) ) {
			return $value;
		}

		if ( is_bool( $value ) ) {
			return $value ? '1' : '0';
		}

		if ( is_int( $value ) || is_float( $value ) ) {
			return (string) $value;
		}

		if ( null === $value ) {
			return '';
		}

		$encoded = wp_json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		return $encoded ? $encoded : '';
	}

	private static function decode( string $value, mixed $default ): mixed {
		if ( is_bool( $default ) ) {
			return in_array( strtolower( trim( $value ) ), [ '1', 'true', 'yes', 'on' ], true );
		}

		if ( is_int( $default ) && 1 === preg_match( '/^-?\d+$/', trim( $value ) ) ) {
			return (int) $value;
		}

		if ( is_float( $default ) && is_numeric( $value ) ) {
			return (float) $value;
		}

		// Backward compatibility for rows written by the earlier JSON-based model.
		$trimmed = trim( $value );
		if ( self::isLegacyJsonValue( $trimmed ) ) {
			try {
				return json_decode( $trimmed, true, 512, JSON_THROW_ON_ERROR );
			} catch ( \JsonException ) {
				return $value;
			}
		}

		return $value;
	}

	private static function isLegacyJsonValue( string $value ): bool {
		$value = trim( $value );

		return 'true' === $value
			|| 'false' === $value
			|| 'null' === $value
			|| str_starts_with( $value, '"' )
			|| str_starts_with( $value, '[' )
			|| str_starts_with( $value, '{' );
	}

	private static function cacheGet( string $key ): mixed {
		if ( array_key_exists( $key, self::$runtimeCache ) ) {
			return self::$runtimeCache[ $key ];
		}

		if ( function_exists( 'wp_cache_get' ) ) {
			$found = false;
			$value = wp_cache_get( $key, self::CACHE_GROUP, false, $found );
			if ( $found ) {
				self::$runtimeCache[ $key ] = $value;
				return $value;
			}
		}

		return self::NOT_FOUND;
	}

	private static function cacheSet( string $key, mixed $value ): void {
		self::$runtimeCache[ $key ] = $value;
		if ( function_exists( 'wp_cache_set' ) ) {
			wp_cache_set( $key, $value, self::CACHE_GROUP );
		}
	}

	private static function cacheDelete( string $key ): void {
		unset( self::$runtimeCache[ $key ] );
		if ( function_exists( 'wp_cache_delete' ) ) {
			wp_cache_delete( $key, self::CACHE_GROUP );
		}
	}
}
