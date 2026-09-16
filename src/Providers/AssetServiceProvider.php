<?php
/**
 * Enqueues the front-end and admin asset bundles.
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
use Blicks\Core\Assets\Asset;
use Blicks\Core\Plugin as BasePlugin;
use Blicks\DesignSystem\CssVariables;
use Blicks\DesignSystem\Keyframes;
use Blicks\Style\Sanitize;

/**
 * Enqueues the front-end and admin scripts and stylesheets.
 */
final class AssetServiceProvider extends ServiceProvider {

	#[Action( 'wp_enqueue_scripts' )]
	public function enqueueFrontend(): void {
		$asset = $this->assetManifest( 'index' );

		// Blocks render as plain HTML and CSS, so the front-end entry is CSS-only and the build
		// emits no script for it. Enqueue one only if a future entry actually produces JS —
		// otherwise every page would carry a <script> tag for a file that does not exist.
		if ( file_exists( BasePlugin::path( 'build/index.js' ) ) ) {
			Asset::script( 'blicks', BasePlugin::url( 'build/index.js' ) )
				->deps( ...$asset['dependencies'] )
				->version( $asset['version'] )
				->footer()
				->enqueue();
		}

		// Vite only emits a CSS file when the entry actually imports styles.
		if ( file_exists( BasePlugin::path( 'build/index.css' ) ) ) {
			Asset::style( 'blicks', BasePlugin::url( 'build/index.css' ) )
				->version( $asset['version'] )
				->enqueue();
		}
	}

	#[Action( 'admin_enqueue_scripts' )]
	public function enqueueAdmin(): void {
		// Matched against the allowlist of our own menu slugs — built-in and registered alike,
		// which is what lets a companion plugin's page get these assets at all. Read-only: it
		// changes no state, so there is nothing for a nonce to protect.
		$page = AdminServiceProvider::currentSlug();
		$views = AdminServiceProvider::views();
		if ( ! isset( $views[ $page ] ) ) {
			return;
		}

		$asset = $this->assetManifest( 'admin' );
		$blockLibrary = $this->assetManifest( 'block-library' );

		Asset::script( 'blicks-block-library', BasePlugin::url( 'build/block-library.js' ) )
			->deps( ...$blockLibrary['dependencies'] )
			->version( $blockLibrary['version'] )
			->footer()
			->enqueue();

		Asset::script( 'blicks-admin', BasePlugin::url( 'build/admin.js' ) )
			->deps( 'blicks-block-library', ...$asset['dependencies'] )
			->version( $asset['version'] )
			->footer()
			->enqueue();

		wp_add_inline_script(
			'blicks-admin',
			'window.blicksAdminSettings = ' . wp_json_encode(
				[
					'buildBaseUrl' => trailingslashit( BasePlugin::url( 'build' ) ),
					'blockBaseUrl' => trailingslashit( BasePlugin::url( 'build/blocks' ) ),
					'cssVariables' => CssVariables::css(),
					'keyframesCss' => Keyframes::css(),
					'version' => defined( 'BLICKS_VERSION' ) ? BLICKS_VERSION : '',
					'view' => $views[ $page ]['view'],
					// A straight view => slug map. `array_flip()` used to do this, which quietly
					// stopped being possible the moment a page became a struct rather than a
					// bare view id — and it is capability-filtered now, so the app never offers
					// a link to a page WordPress would refuse.
					'pageSlugs' => AdminServiceProvider::pageSlugs(),
					// Pages registered by other plugins. The app renders their nav entry from
					// this, and looks up the component a companion script registered at runtime.
					'externalViews' => AdminServiceProvider::externalViews(),
					'adminUrl' => admin_url( 'admin.php' ),
					'docsUrl' => defined( 'BLICKS_DOCS_URI' ) ? BLICKS_DOCS_URI : '',
					'editorUrl' => wp_is_block_theme()
						? admin_url( 'site-editor.php' )
						: admin_url( 'post-new.php?post_type=page' ),
				]
			) . ';',
			'before'
		);

		if ( function_exists( 'wp_set_script_translations' ) ) {
			wp_set_script_translations( 'blicks-admin', 'blicks', BasePlugin::path( 'languages' ) );
			wp_set_script_translations( 'blicks-block-library', 'blicks', BasePlugin::path( 'languages' ) );
		}

		if ( file_exists( BasePlugin::path( 'build/admin.css' ) ) ) {
			// Version the stylesheet by its OWN mtime, not the JS bundle hash — a CSS-only rebuild
			// leaves the JS hash unchanged, so reusing it would keep serving a stale cached file.
			$cssMtime   = filemtime( BasePlugin::path( 'build/admin.css' ) );
			$cssVersion = (string) ( $cssMtime ? $cssMtime : $asset['version'] );

			// theme.json's own variables, first: `--blicks-*` aliases resolve to `--wp--preset--*`,
			// which wp-admin does not define anywhere. Without them every preset-backed token
			// silently falls back to the inherited value — the Design System's type specimens all
			// rendered at the admin's 15px, so eight of the thirteen roles looked identical.
			// Only custom-property declarations, so it cannot restyle admin chrome.
			$themeVariables = function_exists( 'wp_get_global_stylesheet' )
				? wp_get_global_stylesheet( [ 'variables' ] )
				: '';

			Asset::style( 'blicks-admin', BasePlugin::url( 'build/admin.css' ) )
				->version( $cssVersion )
				// Same `</style` guard the front-end path applies (StyleServiceProvider::172,182).
				// Nothing here can currently produce one — CssValue::clean() refuses `<` outright —
				// but the two paths carry the same payload and should not diverge.
				->addInlineStyle(
					Sanitize::styleTagContent( $themeVariables . "\n" . CssVariables::css() . "\n" . Keyframes::css() )
				)
				->enqueue();
		}
	}

	private function assetManifest( string $entry ): array {
		$file = BasePlugin::path( "build/{$entry}.asset.php" );
		return file_exists( $file ) ? require $file : [
			'dependencies' => [],
			'version' => '1.0.0',
		];
	}
}
