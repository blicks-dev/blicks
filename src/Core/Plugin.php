<?php
/**
 * Plugin file location, version and lifecycle hooks.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Where this plugin lives, what version it is, and when it activates or is removed.
 *
 * Booted once from `blicks.php`, then read from anywhere. One plugin, three statics: there is no
 * registry and no backtrace walking, because this class ships inside the only plugin that uses it.
 */
final class Plugin {

	private static string $file = '';
	private static string $path = '';
	private static string $url  = '';

	/** Record the main plugin file. Must run before anything else here is called. */
	public static function boot( string $file ): void {
		self::$file = $file;
		self::$path = plugin_dir_path( $file );
		self::$url  = plugin_dir_url( $file );
	}

	public static function onActivate( callable $callback ): void {
		register_activation_hook( self::$file, $callback );
	}

	public static function onDeactivate( callable $callback ): void {
		register_deactivation_hook( self::$file, $callback );
	}

	public static function onUninstall( callable $callback ): void {
		register_uninstall_hook( self::$file, $callback );
	}

	/** Absolute filesystem path to a file inside the plugin. */
	public static function path( string $relative = '' ): string {
		return self::$path . ltrim( $relative, '/' );
	}

	/** Public URL of a file inside the plugin. */
	public static function url( string $relative = '' ): string {
		return self::$url . ltrim( $relative, '/' );
	}

	/** Plugin basename, e.g. `blicks/blicks.php`. */
	public static function basename(): string {
		return plugin_basename( self::$file );
	}

	/**
	 * The plugin version, for cache busting.
	 *
	 * Read from the constant `blicks.php` defines, not from the file header: this runs on every
	 * front-end request, and `get_plugin_data()` would load `wp-admin/includes/plugin.php` and
	 * re-parse the plugin file each time. `BlicksVersionTest` holds the two in step.
	 */
	public static function version(): string {
		return defined( 'BLICKS_VERSION' ) ? (string) BLICKS_VERSION : '';
	}
}
