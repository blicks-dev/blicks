<?php
/**
 * Plugin Name: Blicks e2e right-to-left
 * Description: Renders a page right to left when asked with `?e2e-rtl=1`, so the specs need no language pack. Test-only; never shipped.
 *
 * Playground runs with networking off, so it cannot install an Arabic or Hebrew translation. What
 * a right-to-left locale changes for a page is `$wp_locale->text_direction`, which `is_rtl()` and
 * `language_attributes()` read: setting it gives the page `<html dir="rtl">` the way a real one does.
 */

add_action(
	'wp_loaded',
	static function () {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a test switch, read-only.
		if ( isset( $_GET['e2e-rtl'] ) && isset( $GLOBALS['wp_locale'] ) ) {
			$GLOBALS['wp_locale']->text_direction = 'rtl';
		}
	}
);
