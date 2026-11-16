<?php
/**
 * Plugin Name: Blicks e2e theme switch
 * Description: Draws one request with another installed theme. Test-only; never shipped.
 *
 * A spec sends `X-Blicks-E2E-Theme: <stylesheet>` (`twentytwentyone`, `ollie`), and that request
 * alone is rendered with that theme, so specs can check the front end on several themes against the
 * one WordPress the suite shares without switching it for everyone else. Unknown or missing themes
 * are ignored.
 */

$blicks_e2e_theme = isset( $_SERVER['HTTP_X_BLICKS_E2E_THEME'] )
	? preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $_SERVER['HTTP_X_BLICKS_E2E_THEME'] ) )
	: '';

if ( '' !== $blicks_e2e_theme && is_dir( WP_CONTENT_DIR . '/themes/' . $blicks_e2e_theme ) ) {
	add_filter( 'pre_option_stylesheet', static fn (): string => $blicks_e2e_theme );
	add_filter( 'pre_option_template', static fn (): string => $blicks_e2e_theme );
}
