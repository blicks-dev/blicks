<?php
/**
 * Loads the Pro modules a development install names.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Plugin as BasePlugin;

/**
 * Pro features are built inside this repository as modules under `modules/<name>/`, each loading
 * the free plugin only through its public extension points, until the v2 release moves them to
 * Blicks Pro (`modules/README.md` in the repository).
 *
 * A module runs only on an install whose `wp-config.php` names it:
 *
 *     define( 'BLICKS_DEV_MODULES', 'header-studio,dialog-studio' );
 *
 * Without the constant this does nothing, and the release zip carries no `modules/` folder for it
 * to find: `scripts/bundle.js` refuses to package one and checks the zip it wrote. A module's own
 * `module.php` registers its autoloader and its provider, exactly as Pro's plugin file will after
 * the move.
 */
final class DevModules {

	/**
	 * The module names in a `BLICKS_DEV_MODULES` value, invalid ones dropped.
	 *
	 * @return list<string>
	 */
	public static function names( mixed $raw ): array {
		if ( ! is_string( $raw ) ) {
			return [];
		}

		$names = array_filter(
			array_map( 'trim', explode( ',', $raw ) ),
			static fn ( string $name ): bool => 1 === preg_match( '/^[a-z][a-z0-9-]*$/', $name )
		);

		return array_values( array_unique( $names ) );
	}

	/** Load each named module that is present. */
	public static function load(): void {
		if ( ! defined( 'BLICKS_DEV_MODULES' ) ) {
			return;
		}

		foreach ( self::names( constant( 'BLICKS_DEV_MODULES' ) ) as $name ) {
			$file = BasePlugin::path( "modules/{$name}/module.php" );

			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	}
}
