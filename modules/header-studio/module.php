<?php
/**
 * Header Studio: a Pro header builder with mega menus, built here until the v2 release.
 *
 * Built and loaded only when `BLICKS_DEV_MODULES` names `header-studio`. Phase 3: the header blocks,
 * their render-time wiring (the phone drawer, the disclosure and scroll behaviours) and their AI
 * catalogue entries and shapes. The Studio mode is phase 4. Moves to Blicks Pro at the v2 release.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// The module's own autoloader, so the folder moves to Blicks Pro without a Composer change here.
spl_autoload_register(
	static function ( string $name ): void {
		$prefix = __NAMESPACE__ . '\\';

		if ( ! str_starts_with( $name, $prefix ) ) {
			return;
		}

		$file = __DIR__ . '/src/' . str_replace( '\\', '/', substr( $name, strlen( $prefix ) ) ) . '.php';

		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
);

( new Module( __DIR__ ) )->register();
