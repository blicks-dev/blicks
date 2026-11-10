<?php
/**
 * Plugin Name: Blicks
 * Plugin URI:  https://blicks.dev
 * Description: Composable Gutenberg blocks with a theme-native design system.
 * Version:     2.0.0
 * Author:      Blicks
 * License:     GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: blicks
 * Domain Path: /languages
 * Requires at least: 7.0
 * Requires PHP: 8.1
 *
 * @package Blicks
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'BLICKS_VERSION' ) ) {
	define( 'BLICKS_VERSION', '2.0.0' );
}

/**
 * Extension API version. Companion plugins load this plugin's classes in-process, so there is no
 * package boundary to version against — this is it. Bump on a breaking change to the surface
 * listed in `tests/Unit/Core/ExtensionApiTest.php`; additive changes need no bump. The JS half,
 * `window.blicks.version` (`resources/framework/public-api.ts`), always carries the same number.
 *
 * 2 — Blicks 2.0's clean break (no Stack, Grid, Spacer or Divider; dropped v1 control ids).
 */
if ( ! defined( 'BLICKS_API_VERSION' ) ) {
	define( 'BLICKS_API_VERSION', '2' );
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

// Maps `Blicks\` onto `src/` and loads the bundled WordPress MCP Adapter. Required at file scope
// because `uninstall_plugin()` includes this file directly and then fires the stored callback.
//
// The shipped plugin uses Jetpack's autoloader, not Composer's: other plugins bundle the same
// adapter — Elementor and Blicks Pro among them — and PHP allows one definition per class. With a
// plain autoloader the first plugin to load wins, whatever its version; with Jetpack's every
// participating plugin declares what it carries and the newest copy wins for the whole site.
//
// A development checkout is the exception. Its vendor/ also holds the dev tools, PHPUnit among
// them, and Jetpack's autoloader would serve those to every plugin and test runner on the site —
// including the integration suite's own, older PHPUnit. There, Composer's loader is appended
// (`prepend-autoloader: false`) and claims nothing another loader already has.
require_once __DIR__ . ( is_dir( __DIR__ . '/vendor/phpunit' ) ? '/vendor/autoload.php' : '/vendor/autoload_packages.php' );

// Early, so the adapter is listening before anything reads the abilities registry. It starts only
// when MCP access has been turned on — see Blicks\Mcp\AdapterBoot.
add_action( 'plugins_loaded', [ Blicks\Mcp\AdapterBoot::class, 'boot' ], 1 );

Plugin::boot( __FILE__ );
