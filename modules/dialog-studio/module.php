<?php
/**
 * Dialog Studio: saved dialogs, opened from anywhere on the site or by themselves.
 *
 * A Pro module, built and loaded only when `BLICKS_DEV_MODULES` names `dialog-studio`, and moved to
 * Blicks Pro at the v2 release (modules/README.md). It reaches the free plugin through public hooks
 * only: `blicks_studio_entity_types`, `blicks_dialog_missing`, `blicks_dialog_markup`,
 * `blicks_studio_modes`, `blicks_admin_views`, and `window.blicks.*` in the browser.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

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
