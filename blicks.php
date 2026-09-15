<?php
/**
 * Plugin Name: Blicks
 * Plugin URI:  https://blicks.dev
 * Description: Composable Gutenberg blocks with a theme-native design system.
 * Version:     1.0.0
 * Author:      Blicks
 * License:     GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: blicks
 * Domain Path: /languages
 * Requires at least: 6.5
 * Requires PHP: 8.1
 *
 * @package Blicks
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'BLICKS_VERSION' ) ) {
	define( 'BLICKS_VERSION', '1.0.0' );
}

if ( ! defined( 'BLICKS_URI' ) ) {
	define( 'BLICKS_URI', 'https://blicks.dev' );
}

if ( ! defined( 'BLICKS_DOCS_URI' ) ) {
	define( 'BLICKS_DOCS_URI', 'https://docs.blicks.dev' );
}

use Blicks\Plugin;

/**
 * Autoload this plugin's classes.
 *
 * Registered at file scope, before anything below runs, because WordPress loads this file on its
 * own during an uninstall — `uninstall_plugin()` does `include_once` on the plugin file and then
 * fires the stored callback, so `Blicks\Plugin::uninstall()` has to be resolvable from here alone.
 *
 * The plugin has no production dependencies, so there is no Composer autoloader in the release.
 */
spl_autoload_register(
	static function ( string $class ): void {
		if ( ! str_starts_with( $class, 'Blicks\\' ) ) {
			return;
		}

		$relative = str_replace( '\\', '/', substr( $class, strlen( 'Blicks\\' ) ) );
		$file     = __DIR__ . '/src/' . $relative . '.php';

		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
);

Plugin::boot( __FILE__ );
