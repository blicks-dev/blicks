<?php
/**
 * Registers the plugin's admin menu pages and action links.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\ServiceProvider;
use UupCode\Utilities\Attributes\Action;
use UupCode\Utilities\Attributes\Filter;

/**
 * Registers the admin submenu pages and the plugin action links.
 */
final class AdminServiceProvider extends ServiceProvider {

	public const PARENT_SLUG = 'blicks';

	/**
	 * Every admin view is its own submenu page so it can be reached from the WP menu and
	 * bookmarked. They all render the same SPA root — the slug only decides which view the
	 * app boots into (see AssetServiceProvider, which injects it as `view`).
	 *
	 * @return array<string,string> slug => view id
	 */
	public static function views(): array {
		return [
			self::PARENT_SLUG => 'overview',
			'blicks-design' => 'design',
			'blicks-settings' => 'settings',
		];
	}

	/** The view the current request should boot into, defaulting to the Overview. */
	public static function currentView(): string {
		// Read-only: selects which SPA view to boot into. Changes no state, so a nonce would
		// protect nothing. Unslashed and sanitized, then matched against our own slug allowlist.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		return self::views()[ $page ] ?? 'overview';
	}

	#[Action( 'admin_menu' )]
	public function addMenuPages(): void {
		add_menu_page(
			__( 'Blicks', 'blicks' ),
			__( 'Blicks', 'blicks' ),
			'manage_options',
			self::PARENT_SLUG,
			[ $this, 'renderPage' ],
			$this->menuIcon(),
			26
		);

		// The first submenu re-registers the parent slug so WP labels it "Overview" instead of
		// repeating "Blicks" — the rest add the remaining views.
		$labels = [
			self::PARENT_SLUG => __( 'Overview', 'blicks' ),
			'blicks-design' => __( 'Design System', 'blicks' ),
			'blicks-settings' => __( 'Settings', 'blicks' ),
		];

		foreach ( $labels as $slug => $label ) {
			add_submenu_page(
				self::PARENT_SLUG,
				sprintf(
					/* translators: %s: admin view name, e.g. "Design System". */
					__( 'Blicks — %s', 'blicks' ),
					$label
				),
				$label,
				'manage_options',
				$slug,
				[ $this, 'renderPage' ]
			);
		}
	}

	public function renderPage(): void {
		printf(
			'<div id="blicks-admin-root" class="blicks-admin-root" data-view="%s"></div>',
			esc_attr( self::currentView() )
		);
	}

	#[Filter( 'plugin_action_links_blicks/blicks.php' )]
	public function addActionLinks( array $links ): array {
		$links[] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( admin_url( 'admin.php?page=blicks-settings' ) ),
			esc_html__( 'Settings', 'blicks' )
		);
		return $links;
	}

	/**
	 * The admin menu icon, inlined as a data URI so it needs no HTTP request and no
	 * separate asset. The SVG is a hardcoded literal — no dynamic input reaches it.
	 */
	private function menuIcon(): string {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><g fill="currentColor"><rect x="20" y="20" width="100" height="40"/><rect x="20" y="70" width="80" height="40"/><rect x="20" y="120" width="110" height="40"/></g><rect x="135" y="120" width="20" height="40" fill="currentColor"/></svg>';

        // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Static SVG literal encoded for a data: URI, not obfuscation.
		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}
}
