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

use Blicks\Core\ServiceProvider;
use Blicks\Core\Attributes\Action;
use Blicks\Core\Attributes\Filter;

/**
 * Registers the admin submenu pages and the plugin action links.
 */
final class AdminServiceProvider extends ServiceProvider {

	public const PARENT_SLUG = 'blicks';

	/** Capability every built-in view requires, and the default for a registered one. */
	public const DEFAULT_CAPABILITY = 'manage_options';

	/**
	 * Every admin view is its own submenu page so it can be reached from the WP menu and
	 * bookmarked. They all render the same SPA root — the slug only decides which view the
	 * app boots into (see AssetServiceProvider, which injects it as `view`).
	 *
	 * One entry carries everything a page needs: the view id the app routes on, the menu label,
	 * and the capability. They were two parallel arrays keyed by the same slug, which is a drift
	 * bug waiting to happen and would have meant a companion plugin hooking two filters to add
	 * one page.
	 *
	 * @return array<string, array{view:string,label:string,capability:string}> slug => page
	 */
	public static function views(): array {
		$builtin = [
			self::PARENT_SLUG => [
				'view' => 'overview',
				'label' => __( 'Overview', 'blicks' ),
				'capability' => self::DEFAULT_CAPABILITY,
			],
			'blicks-design' => [
				'view' => 'design',
				'label' => __( 'Design System', 'blicks' ),
				'capability' => self::DEFAULT_CAPABILITY,
			],
			'blicks-settings' => [
				'view' => 'settings',
				'label' => __( 'Settings', 'blicks' ),
				'capability' => self::DEFAULT_CAPABILITY,
			],
		];

		/**
		 * Filters the pages in the Blicks admin.
		 *
		 * Companion plugins add a page here and get the submenu, the SPA route and the asset
		 * enqueue in one step. Rendering the page's contents is a separate, JS-side registration.
		 *
		 * Built-in pages are restored after filtering, so a buggy or hostile callback can add
		 * pages but cannot remove, relabel or re-capability the ones this plugin owns — losing
		 * the Settings screen because a third party returned the wrong shape is not a failure
		 * mode worth allowing.
		 *
		 * @param array<string, array{view:string,label:string,capability:string}> $views slug => page.
		 */
		$filtered = apply_filters( 'blicks_admin_views', $builtin );

		// `+`, not array_merge(): the union operator keeps the left-hand side on a key collision
		// *and* puts its keys first, so the built-ins both win and stay at the top of the menu.
		// array_merge() would have listed every registered page above Overview.
		return $builtin + self::normalizeViews( $filtered, $builtin );
	}

	/**
	 * Drop anything from the filter that is not a usable page.
	 *
	 * A malformed entry would otherwise reach `add_submenu_page()` and break the menu for every
	 * user, so this is a gate, not a convenience: an entry is kept only if its slug, view id and
	 * label are all non-empty strings.
	 *
	 * @param mixed                                                             $filtered Raw filter output.
	 * @param array<string, array{view:string,label:string,capability:string}> $builtin  Pages this plugin owns.
	 * @return array<string, array{view:string,label:string,capability:string}>
	 */
	private static function normalizeViews( mixed $filtered, array $builtin ): array {
		if ( ! is_array( $filtered ) ) {
			return [];
		}

		$views = [];

		foreach ( $filtered as $slug => $page ) {
			$slug = is_string( $slug ) ? sanitize_key( $slug ) : '';

			if ( '' === $slug || isset( $builtin[ $slug ] ) || ! is_array( $page ) ) {
				continue;
			}

			$view = isset( $page['view'] ) && is_string( $page['view'] ) ? trim( $page['view'] ) : '';
			$label = isset( $page['label'] ) && is_string( $page['label'] ) ? trim( $page['label'] ) : '';

			if ( '' === $view || '' === $label ) {
				continue;
			}

			$capability = isset( $page['capability'] ) && is_string( $page['capability'] ) && '' !== $page['capability']
				? $page['capability']
				: self::DEFAULT_CAPABILITY;

			$views[ $slug ] = [
				'view' => $view,
				'label' => $label,
				'capability' => $capability,
			];
		}

		return $views;
	}

	/**
	 * View id => page slug, for the views the current user may actually open.
	 *
	 * This is what the app routes on, so it is capability-filtered: offering a nav link to a page
	 * WordPress will refuse is a dead end the user cannot diagnose.
	 *
	 * @return array<string, string>
	 */
	public static function pageSlugs(): array {
		$slugs = [];

		foreach ( self::views() as $slug => $page ) {
			if ( current_user_can( $page['capability'] ) ) {
				$slugs[ $page['view'] ] = $slug;
			}
		}

		return $slugs;
	}

	/**
	 * The views this plugin does not own, for the admin app's nav.
	 *
	 * The app needs to know a page exists before the companion plugin's own script has run —
	 * otherwise the tab only appears once that bundle loads, and never at all if it fails. The
	 * label is translated here, in the plugin that owns the string.
	 *
	 * @return list<array{id:string,label:string,slug:string}>
	 */
	public static function externalViews(): array {
		$builtin = [ 'overview', 'design', 'settings' ];
		$external = [];

		foreach ( self::views() as $slug => $page ) {
			if ( in_array( $page['view'], $builtin, true ) || ! current_user_can( $page['capability'] ) ) {
				continue;
			}

			$external[] = [
				'id' => $page['view'],
				'label' => $page['label'],
				'slug' => $slug,
			];
		}

		return $external;
	}

	/** The view a slug maps to, or an empty string when the slug is not ours. */
	public static function viewForSlug( string $slug ): string {
		return self::views()[ $slug ]['view'] ?? '';
	}

	/** The view the current request should boot into, defaulting to the Overview. */
	public static function currentView(): string {
		$view = self::viewForSlug( self::currentSlug() );

		return '' !== $view ? $view : 'overview';
	}

	/** The `page` query arg, sanitized. */
	public static function currentSlug(): string {
		// Read-only: selects which SPA view to boot into. Changes no state, so a nonce would
		// protect nothing. Unslashed and sanitized, then matched against our own slug allowlist.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
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
		// repeating "Blicks" — the rest add the remaining views, registered ones included.
		foreach ( self::views() as $slug => $page ) {
			add_submenu_page(
				self::PARENT_SLUG,
				sprintf(
					/* translators: %s: admin view name, e.g. "Design System". */
					__( 'Blicks — %s', 'blicks' ),
					$page['label']
				),
				$page['label'],
				$page['capability'],
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
