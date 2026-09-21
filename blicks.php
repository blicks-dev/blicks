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

/**
 * Extension API version. Companion plugins load this plugin's classes in-process, so there is no
 * package boundary to version against — this is it. Bump on a breaking change to the surface
 * listed in `tests/Unit/Core/ExtensionApiTest.php`; additive changes need no bump.
 */
if ( ! defined( 'BLICKS_API_VERSION' ) ) {
	define( 'BLICKS_API_VERSION', '1' );
}

if ( ! defined( 'BLICKS_URI' ) ) {
	define( 'BLICKS_URI', 'https://blicks.dev' );
}

if ( ! defined( 'BLICKS_DOCS_URI' ) ) {
	define( 'BLICKS_DOCS_URI', 'https://docs.blicks.dev' );
}

/**
 * The public source repository. Bug reports and feature requests are filed here, and both the
 * Plugins-screen row and the admin app build their links from it — so the host lives in one place
 * rather than being spelled out at each call site.
 */
if ( ! defined( 'BLICKS_REPO_URI' ) ) {
	define( 'BLICKS_REPO_URI', 'https://github.com/blicks-dev/blicks' );
}

use Blicks\Plugin;

// Maps `Blicks\` onto `src/`; the plugin has no production dependencies. Required at file scope
// because `uninstall_plugin()` includes this file directly and then fires the stored callback.
require_once __DIR__ . '/vendor/autoload.php';

Plugin::boot( __FILE__ );
