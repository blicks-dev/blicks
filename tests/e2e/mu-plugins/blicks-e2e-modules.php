<?php
/**
 * Plugin Name: Blicks e2e modules
 * Description: Loads the Pro modules a request names in its `blicks_e2e_modules` cookie, so a spec can turn a module on for its own browser contexts only. Test-only; never shipped.
 *
 * `BLICKS_DEV_MODULES` must be defined before the plugin loads, which a must-use plugin is.
 * A cookie, not a constant in the blueprint, so specs that do not ask keep the free plugin alone.
 */

// phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- a test switch; the plugin checks each name.
$blicks_e2e_modules = isset( $_COOKIE['blicks_e2e_modules'] ) ? (string) $_COOKIE['blicks_e2e_modules'] : '';

if ( '' !== $blicks_e2e_modules && ! defined( 'BLICKS_DEV_MODULES' ) && 1 === preg_match( '/^[a-z0-9,-]+$/', $blicks_e2e_modules ) ) {
	define( 'BLICKS_DEV_MODULES', $blicks_e2e_modules );
}
