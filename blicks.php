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
 * Requires at least: 6.6
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
 * Composer's autoloader. The plugin has no production dependencies — this maps the `Blicks\`
 * namespace onto `src/` and nothing else.
 *
 * Required at file scope, before Plugin::boot(), because WordPress loads this file on its own
 * during an uninstall: `uninstall_plugin()` includes it and then fires the stored callback, so
 * `Blicks\Plugin::uninstall()` has to be resolvable from here alone.
 */
require_once __DIR__ . '/vendor/autoload.php';

Plugin::boot( __FILE__ );
