<?php
/**
 * Bootstrap for the WordPress integration suite.
 *
 * Unlike tests/Unit, this loads a real WordPress: real hooks, a real database, a real
 * REST server. WP_TESTS_DIR is provided by wp-env's tests container.
 *
 * @package Blicks
 */

declare(strict_types=1);

$_tests_dir = getenv( 'WP_TESTS_DIR' ) ?: '/wordpress-phpunit';

if ( ! file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	fwrite(
		STDERR,
		"Could not find the WordPress test suite at {$_tests_dir}.\n" .
		"Run these tests through wp-env:\n\n" .
		"  pnpm test:integration\n\n"
	);
	exit( 1 );
}

require_once $_tests_dir . '/includes/functions.php';

/**
 * Load the plugin before WordPress finishes booting, so its providers register on the
 * same hooks they would on a real site.
 */
tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		// The modules' own integration tests run with the rest; each skips itself when its
		// module is not loaded, so without this they pass by never running. A site that names
		// modules itself keeps its choice.
		if ( ! defined( 'BLICKS_DEV_MODULES' ) ) {
			define( 'BLICKS_DEV_MODULES', 'header-studio,dialog-studio' );
		}

		require dirname( __DIR__, 2 ) . '/blicks.php';
	}
);

require $_tests_dir . '/includes/bootstrap.php';
