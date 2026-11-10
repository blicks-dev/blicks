<?php
/**
 * The module's own classes for its unit tests, by the same rule as `module.php`'s autoloader,
 * without registering the module's hooks.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

spl_autoload_register(
	static function ( string $name ): void {
		$prefix = 'BlicksPro\\DialogStudio\\';

		if ( str_starts_with( $name, $prefix ) && ! str_starts_with( $name, $prefix . 'Tests\\' ) ) {
			$file = dirname( __DIR__ ) . '/src/' . str_replace( '\\', '/', substr( $name, strlen( $prefix ) ) ) . '.php';

			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	}
);
