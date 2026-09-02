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

require_once __DIR__ . '/vendor/autoload.php';

Plugin::boot( __FILE__ );
